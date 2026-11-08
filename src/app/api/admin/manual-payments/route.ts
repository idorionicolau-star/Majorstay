export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { applyPaidPayment } from '@/lib/billing-server';

/** Pagamentos directos (M-Pesa / e-Mola) — os mais recentes primeiro. Só o super-administrador. */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const qs = await initializeAdmin().firestore().collection('manualPayments').orderBy('createdAt', 'desc').limit(50).get();
    return NextResponse.json({ payments: qs.docs.map((d) => d.data()) });
}

/** Confirmar (activa a conta pelos meses do plano) ou recusar um pagamento directo. */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const { reference, action } = await req.json().catch(() => ({}));
    if (typeof reference !== 'string' || !reference || reference.includes('/') || !['confirm', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }
    const db = initializeAdmin().firestore();
    const mRef = db.doc(`manualPayments/${reference}`);
    const m = await mRef.get();
    if (!m.exists) return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    const now = new Date().toISOString();
    const by = decoded.email || decoded.uid;

    if (action === 'reject') {
        if (m.get('status') === 'paid') return NextResponse.json({ error: 'Este pagamento já foi confirmado.' }, { status: 409 });
        await db.doc(`companies/${m.get('companyId')}/payments/${reference}`).update({ status: 'failed', updatedAt: now });
        await mRef.update({ status: 'rejected', decidedAt: now, decidedBy: by });
        return NextResponse.json({ ok: true, status: 'rejected' });
    }

    const r = await applyPaidPayment(reference, {});
    if (!r.ok) return NextResponse.json({ error: 'Não foi possível activar.', reason: (r as any).reason }, { status: 400 });
    await mRef.update({ status: 'paid', decidedAt: now, decidedBy: by, ...((r as any).end ? { until: (r as any).end } : {}) });
    return NextResponse.json({ ok: true, status: 'paid', until: (r as any).end || null });
}
