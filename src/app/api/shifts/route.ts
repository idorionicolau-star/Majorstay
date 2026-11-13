export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { cashDifference, dayKeyMaputo, summarizeShiftSales } from '@/lib/shifts';

/**
 * Turnos de caixa (um por recepcionista por dia).
 * GET  ?companyId=…            → { current, closedToday, recent? }  (recent só para Admin/Dono)
 * POST { companyId, action:'open',  openingCash }
 * POST { companyId, action:'close', countedCash, notes }
 * O servidor calcula o esperado a partir das vendas (nunca confia nos valores do cliente) e guarda tudo em companies/{c}/shifts.
 */
type Ctx = { uid: string; name: string; isManager: boolean; db: FirebaseFirestore.Firestore; companyId: string };

async function authorize(req: Request, companyId: string): Promise<{ error: NextResponse } | Ctx> {
  const decoded = (await verifyIdToken(req)) as { uid: string; email?: string; name?: string; superAdmin?: boolean; companyId?: string } | null;
  if (!decoded) return { error: NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 }) };
  if (!companyId) return { error: NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 }) };
  if (!decoded.superAdmin && companyId !== decoded.companyId) {
    return { error: NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 }) };
  }
  const db = initializeAdmin().firestore();
  let name = decoded.name || decoded.email || 'Funcionário';
  let isManager = decoded.superAdmin === true;
  let allowed = isManager;
  if (!allowed) {
    const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (emp.exists) {
      const d = emp.data() || {};
      name = (d.username as string) || name;
      const role = d.role as string;
      isManager = role === 'Admin' || role === 'Dono';
      allowed = isManager || d.permissions?.rooms === 'write' || d.permissions?.rooms === 'read';
    }
  }
  if (!allowed) return { error: NextResponse.json({ error: 'Sem permissão para turnos.' }, { status: 403 }) };
  return { uid: decoded.uid, name, isManager, db, companyId };
}

const iso = (v: any): string | null => {
  if (!v) return null;
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function view(id: string, d: Record<string, any>) {
  return {
    id,
    employeeName: d.openedByName || '',
    openedAt: iso(d.openedAt),
    closedAt: iso(d.closedAt),
    status: d.status === 'closed' ? 'closed' : 'open',
    openingCash: Number(d.openingCash) || 0,
    countedCash: d.countedCash ?? null,
    expectedCash: d.expectedCash ?? null,
    difference: d.difference ?? null,
    totals: d.totals || null,
    notes: d.notes || '',
  };
}

async function liveTotals(ctx: Ctx, shift: Record<string, any>) {
  const openedAt = (shift.openedAt?.toDate ? shift.openedAt.toDate() : new Date(shift.openedAt)) as Date;
  const admin = initializeAdmin();
  const snap = await ctx.db
    .collection(`companies/${ctx.companyId}/sales`)
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(openedAt))
    .limit(2000)
    .get();
  const totals = summarizeShiftSales(snap.docs.map((d) => d.data()), String(shift.openedByName || ''), openedAt, new Date());
  return { totals, ...cashDifference(Number(shift.openingCash) || 0, totals.cash, 0) };
}

async function findOpen(ctx: Ctx) {
  const snap = await ctx.db
    .collection(`companies/${ctx.companyId}/shifts`)
    .where('openedByUid', '==', ctx.uid)
    .where('status', '==', 'open')
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

export async function GET(req: Request) {
  try {
    const companyId = new URL(req.url).searchParams.get('companyId') || '';
    const ctx = await authorize(req, companyId);
    if ('error' in ctx) return ctx.error;

    const openDoc = await findOpen(ctx);
    let current = null as null | (ReturnType<typeof view> & { live: { totals: any; expectedCash: number } });
    if (openDoc) {
      const data = openDoc.data();
      const live = await liveTotals(ctx, data);
      current = { ...view(openDoc.id, data), live: { totals: live.totals, expectedCash: live.expectedCash } };
    }
    const todayDoc = await ctx.db.doc(`companies/${companyId}/shifts/${ctx.uid}_${dayKeyMaputo()}`).get();
    const closedToday = todayDoc.exists && todayDoc.data()?.status === 'closed' ? view(todayDoc.id, todayDoc.data()!) : null;

    let recent: ReturnType<typeof view>[] | undefined;
    if (ctx.isManager) {
      const snap = await ctx.db.collection(`companies/${companyId}/shifts`).orderBy('openedAt', 'desc').limit(30).get();
      recent = snap.docs.map((d) => view(d.id, d.data()));
    }
    return NextResponse.json({ current, closedToday, ...(recent ? { recent } : {}) });
  } catch (err) {
    console.error('Erro em GET /api/shifts:', err);
    return NextResponse.json({ error: 'Não foi possível carregar o turno.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = String(body.companyId || '');
    const ctx = await authorize(req, companyId);
    if ('error' in ctx) return ctx.error;
    const admin = initializeAdmin();

    if (body.action === 'open') {
      const opening = Number(body.openingCash);
      if (!Number.isFinite(opening) || opening < 0 || opening > 1e9) {
        return NextResponse.json({ error: 'Fundo de caixa inválido.' }, { status: 400 });
      }
      if (await findOpen(ctx)) {
        return NextResponse.json({ error: 'Já tem um turno aberto.' }, { status: 409 });
      }
      const ref = ctx.db.doc(`companies/${companyId}/shifts/${ctx.uid}_${dayKeyMaputo()}`);
      await ctx.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) throw Object.assign(new Error('Já abriu (e fechou) o turno de hoje. Só é possível um turno por dia.'), { status: 409 });
        tx.set(ref, {
          openedByUid: ctx.uid,
          openedByName: ctx.name,
          openedAt: admin.firestore.FieldValue.serverTimestamp(),
          openingCash: opening,
          status: 'open',
          companyId,
        });
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'close') {
      const counted = Number(body.countedCash);
      if (!Number.isFinite(counted) || counted < 0 || counted > 1e9) {
        return NextResponse.json({ error: 'Dinheiro contado inválido.' }, { status: 400 });
      }
      const openDoc = await findOpen(ctx);
      if (!openDoc) return NextResponse.json({ error: 'Não tem nenhum turno aberto.' }, { status: 404 });
      const data = openDoc.data();
      const live = await liveTotals(ctx, data);
      const { expectedCash, difference } = cashDifference(Number(data.openingCash) || 0, live.totals.cash, counted);
      await openDoc.ref.update({
        status: 'closed',
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        countedCash: counted,
        expectedCash,
        difference,
        totals: live.totals,
        notes: String(body.notes || '').slice(0, 500),
      });
      return NextResponse.json({ success: true, expectedCash, difference, totals: live.totals });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    if (err?.status === 409) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('Erro em POST /api/shifts:', err);
    return NextResponse.json({ error: 'Não foi possível guardar o turno.' }, { status: 500 });
  }
}
