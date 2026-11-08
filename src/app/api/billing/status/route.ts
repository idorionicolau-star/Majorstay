export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { applyPaidPayment, zumbopay } from '@/lib/billing-server';
import { paymentStatusOf } from '@/lib/zumbopay-core';

/**
 * Estado de um pagamento (usado quando o cliente volta do checkout). O webhook é a via principal; se ainda não
 * chegou, pergunta-se à ZumboPay pelo link de pagamento.
 */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.companyId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const reference = new URL(req.url).searchParams.get('ref') || '';
    if (!reference || reference.includes('/')) return NextResponse.json({ error: 'Referência inválida.' }, { status: 400 });
    const db = initializeAdmin().firestore();
    const pRef = db.doc(`companies/${decoded.companyId}/payments/${reference}`);
    const snap = await pRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    let p = snap.data()!;

    const lookup = p.providerReference || p.slug;
    if (p.status === 'pending' && lookup) {
        try {
            const r = await zumbopay<{ data: any }>(`/payments/${encodeURIComponent(lookup)}`);
            const st = paymentStatusOf(r?.data);
            if (st === 'paid') await applyPaidPayment(reference, { providerId: p.providerId || undefined });
            else if (st === 'failed') await pRef.update({ status: 'failed', updatedAt: new Date().toISOString() });
            p = (await pRef.get()).data()!;
        } catch { /* fica pendente: o webhook confirma */ }
    }
    return NextResponse.json({ status: p.status, planId: p.planId, amount: p.amount, periodEnd: p.periodEnd || null });
}
