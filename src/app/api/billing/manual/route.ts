export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { companyPayer, planAmountFor } from '@/lib/billing-server';
import { planById } from '@/lib/plans';
import { tierAmount, tierLabel } from '@/lib/tiers';
import { Resend } from 'resend';
import { isManualMethod, manualPaymentEmail, paymentReference } from '@/lib/manual-pay-core';
import { SUPPORT } from '@/lib/support';
import { formatCurrency } from '@/lib/utils';

const APP_URL = 'https://stock.majorgroup.app';

/**
 * Pagamento directo por M-Pesa / e-Mola (ver lib/manual-pay-core.ts): regista o pedido como pendente, com o valor
 * calculado no servidor, e devolve a referência. A conta só é activada quando o super-administrador confirmar.
 */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const companyId: string | undefined = decoded.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 400 });

    const { planId, method, tier: tierId } = await req.json().catch(() => ({}));
    const plan = planById(planId);
    if (!plan) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    if (!isManualMethod(method)) return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 });

    const payer = await companyPayer(companyId, decoded);
    if (!payer) return NextResponse.json({ error: 'Só o administrador da empresa pode pagar a subscrição.' }, { status: 403 });

    const db = initializeAdmin().firestore();
    const now = new Date();
    const reference = paymentReference(companyId, now);
    const { amount, coupon, tier } = await planAmountFor(companyId, plan, tierId);
    if (!tier) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    const companyName = (await db.doc(`companies/${companyId}`).get()).get('name') || '';

    const batch = db.batch();
    batch.set(db.doc(`billingRefs/${reference}`), { companyId, reference, createdAt: now.toISOString() });
    batch.set(db.doc(`companies/${companyId}/payments/${reference}`), {
        reference, provider: 'manual', method, planId: plan.id, tier, months: plan.months, amount,
        ...(coupon ? { coupon, fullAmount: tierAmount(tier, plan.id) } : {}),
        status: 'pending', createdAt: now.toISOString(), createdBy: payer.username,
    });
    // lista do super-administrador (só o servidor lê e escreve)
    batch.set(db.doc(`manualPayments/${reference}`), {
        reference, companyId, companyName, method, planId: plan.id, tier, amount,
        email: decoded.email || null, createdBy: payer.username, createdAt: now.toISOString(), status: 'pending',
    });
    await batch.commit();

    // aviso por email ao super-administrador (se falhar, o pedido fica na mesma no painel)
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
        try {
            const mail = manualPaymentEmail({
                company: companyName || companyId, email: decoded.email || null, createdBy: payer.username,
                plan: `${tierLabel(tier)} · ${plan.label}`, amount: formatCurrency(amount), method, reference, adminUrl: `${APP_URL}/admin/subscriptions`,
            });
            const res: any = await new Resend(apiKey).emails.send({ from: 'Major Assistant <assistant@majorgroup.app>', to: [SUPPORT.email], subject: mail.subject, html: mail.html });
            if (res?.error) console.error('manual payment email', res.error);
        } catch (e) {
            console.error('manual payment email', e);
        }
    }
    return NextResponse.json({ reference, amount });
}
