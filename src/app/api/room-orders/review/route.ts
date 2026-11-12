export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/**
 * GET /api/room-orders/review?companyId=… — só Admin/Dono.
 * Devolve o que o dono deve vigiar: pedidos do hóspede RECUSADOS e consumos REMOVIDOS da conta,
 * com quem fez, quando, o motivo e o valor.
 */
function toIso(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
  return '';
}

export async function GET(req: Request) {
  try {
    const companyId = new URL(req.url).searchParams.get('companyId') || '';
    const decoded = (await verifyIdToken(req)) as { uid: string; superAdmin?: boolean; companyId?: string } | null;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    if (!companyId) return NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 });
    if (!decoded.superAdmin && companyId !== decoded.companyId) {
      return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });
    }

    const db = initializeAdmin().firestore();
    if (!decoded.superAdmin) {
      const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
      const role = emp.exists ? (emp.data()?.role as string) : '';
      if (!['Admin', 'Dono'].includes(role)) {
        return NextResponse.json({ error: 'Só o administrador ou o dono pode ver este controlo.' }, { status: 403 });
      }
    }

    const [rejectedSnap, removedSnap] = await Promise.all([
      db.collection(`companies/${companyId}/roomOrders`).where('status', '==', 'rejected').limit(200).get(),
      db.collection(`companies/${companyId}/hospitalityAudit`).where('action', '==', 'remove_consumption').limit(200).get(),
    ]);

    const rejectedOrders = rejectedSnap.docs
      .map((d) => {
        const o = d.data() as Record<string, any>;
        return {
          id: d.id,
          roomName: String(o.roomName || ''),
          total: Number(o.total) || 0,
          items: Array.isArray(o.items)
            ? o.items.map((i: any) => ({ name: String(i.productName || ''), quantity: Number(i.quantity) || 0 }))
            : [],
          reason: String(o.rejectReason || ''),
          by: String(o.resolvedByName || ''),
          at: toIso(o.resolvedAt),
          requestedAt: toIso(o.createdAt),
        };
      })
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100);

    const removedRaw = removedSnap.docs
      .map((d) => {
        const a = d.data() as Record<string, any>;
        const before = Number(a.before?.consumptionsTotal) || 0;
        const after = Number(a.after?.consumptionsTotal) || 0;
        const reasonText = String(a.reason || '').replace(/^Remoção de consumo:\s*/i, '');
        return { id: d.id, stayId: String(a.targetId || ''), value: Math.max(0, before - after), reason: reasonText, by: String(a.userName || ''), at: toIso(a.timestamp) };
      })
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100);

    const stayIds = Array.from(new Set(removedRaw.map((r) => r.stayId).filter(Boolean)));
    const stayNames = new Map<string, string>();
    await Promise.all(
      stayIds.map(async (id) => {
        const s = await db.doc(`companies/${companyId}/stays/${id}`).get();
        if (s.exists) stayNames.set(id, String(s.data()?.roomName || ''));
      })
    );
    const removedConsumptions = removedRaw.map((r) => ({ ...r, roomName: stayNames.get(r.stayId) || '' }));

    return NextResponse.json({ rejectedOrders, removedConsumptions });
  } catch (err) {
    console.error('Erro em GET /api/room-orders/review:', err);
    return NextResponse.json({ error: 'Erro ao carregar o controlo.' }, { status: 500 });
  }
}
