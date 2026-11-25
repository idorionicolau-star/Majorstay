export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { calculateExpectedCheckOut, stayChargeForHours, totalContractedHours } from '@/lib/hospitality-calc';
import { subscriptionBlocked, MAX_CONTRACTED_HOURS } from '@/lib/stay-checkin';

/**
 * Prorrogação de estadia, feita no servidor: as horas acrescentadas e o novo total são calculados aqui,
 * com o preço que ficou gravado na estadia no check-in. O computador não escreve horas nem valores.
 */
async function authorizeUser(req: Request, companyId: unknown) {
  const decoded = (await verifyIdToken(req)) as any;
  if (!decoded) return { error: NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 }) };
  if (!companyId || typeof companyId !== 'string') return { error: NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 }) };
  if (!decoded.superAdmin && companyId !== decoded.companyId) return { error: NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 }) };

  const admin = initializeAdmin();
  const db = admin.firestore();
  let employeeName = decoded.name || decoded.email || 'Recepção';
  let ok = decoded.superAdmin === true;
  if (!ok) {
    const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (emp.exists) {
      const d = emp.data() || {};
      employeeName = d.username || employeeName;
      if (d.role === 'Admin' || d.permissions?.rooms === 'write') ok = true;
    }
  }
  if (!ok) return { error: NextResponse.json({ error: 'Sem permissão para prorrogar estadias neste alojamento.' }, { status: 403 }) };
  return { decoded, employeeName, db, admin };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, stayId } = body;
    if (!stayId || typeof stayId !== 'string') return NextResponse.json({ error: 'Estadia em falta.' }, { status: 400 });
    const hours = Math.ceil(Number(body.hours));
    if (!Number.isFinite(hours) || hours < 1 || hours > MAX_CONTRACTED_HOURS) {
      return NextResponse.json({ error: 'Horas inválidas: o mínimo é 1 hora.' }, { status: 400 });
    }

    const auth = await authorizeUser(req, companyId);
    if ('error' in auth) return auth.error;
    const { decoded, employeeName, db, admin } = auth;

    const stayRef = db.doc(`companies/${companyId}/stays/${stayId}`);
    const companyRef = db.doc(`companies/${companyId}`);
    const notes = String(body.notes ?? '').trim().slice(0, 300);

    const result = await db.runTransaction(async (tx) => {
      const [staySnap, companySnap] = await Promise.all([tx.get(stayRef), tx.get(companyRef)]);
      if (!staySnap.exists) throw Object.assign(new Error('Estadia não encontrada.'), { http: 404 });
      const stay = staySnap.data() || {};
      if (stay.status !== 'open') throw Object.assign(new Error('Esta estadia já foi encerrada.'), { http: 409 });
      const company = (companySnap.exists ? companySnap.data() : {}) || {};
      if (!decoded.superAdmin && subscriptionBlocked(company, Date.now())) {
        throw Object.assign(new Error('A subscrição deste alojamento não está ativa. Contacte o administrador.'), { http: 403 });
      }

      const ext = {
        hours,
        addedAt: new Date().toISOString(),
        addedBy: decoded.uid,
        addedByName: employeeName,
        ...(notes ? { notes } : {}),
      };
      const extensions = [...(Array.isArray(stay.extensions) ? stay.extensions : []), ext];
      const expected = calculateExpectedCheckOut(stay.checkInAt, stay.contractedHours, extensions);
      const consumptionsTotal = (Array.isArray(stay.consumptions) ? stay.consumptions : []).reduce((s: number, c: any) => s + (Number(c.totalPrice) || 0), 0);
      const total = totalContractedHours({ contractedHours: stay.contractedHours, extensions });
      const totalAmountDue = stayChargeForHours(stay, total) + consumptionsTotal;

      tx.update(stayRef, { extensions, expectedCheckOutAt: expected.toISOString(), totalAmountDue });

      const auditRef = db.collection(`companies/${companyId}/hospitalityAudit`).doc();
      tx.set(auditRef, {
        action: 'extend_stay',
        targetId: stayId,
        targetType: 'stay',
        before: { totalAmountDue: stay.totalAmountDue ?? null, hours: totalContractedHours(stay as any) },
        after: { totalAmountDue, hours: total, addedHours: hours },
        reason: `Prorrogação de ${hours}h`,
        userId: decoded.uid,
        userName: employeeName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        companyId,
      });
      return { roomName: stay.roomName || 'Quarto', totalAmountDue, expectedCheckOutAt: expected.toISOString() };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    if (e?.http) return NextResponse.json({ error: e.message }, { status: e.http });
    console.error('[stays/extend]', e);
    return NextResponse.json({ error: 'Não foi possível prorrogar a estadia. Tente de novo.' }, { status: 500 });
  }
}
