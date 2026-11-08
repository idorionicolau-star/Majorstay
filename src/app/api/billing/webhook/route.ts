export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { applyPaidPayment, findPaymentByRef } from '@/lib/billing-server';
import { eventAmount, extractPaymentRefs, verifyZumbopaySignature } from '@/lib/zumbopay-core';

/**
 * Webhook da ZumboPay (Painel → Programadores): URL = https://<o-seu-site>/api/billing/webhook
 * Eventos: payment.succeeded, payment.failed, payment.refunded.
 * Verifica a assinatura (`x-zumbopay-signature`: HMAC-SHA256 hex do corpo bruto) antes de fazer seja o que for.
 * Pagamentos que não são nossos (a mesma conta pode receber outros) são ignorados com 200, para não haver reentregas.
 */
export async function POST(req: Request) {
    const raw = await req.text();
    if (!verifyZumbopaySignature(raw, req.headers.get('x-zumbopay-signature'), process.env.ZUMBOPAY_WEBHOOK_SECRET)) {
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
    let evt: any;
    try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
    const eventName = String(evt?.event || evt?.type || '');

    const db = initializeAdmin().firestore();
    const refs = extractPaymentRefs(evt);
    let outcome: Record<string, unknown> = { ok: true, ignored: 'event' };
    let matched: { reference: string; companyId: string } | null = null;
    try {
        for (const r of refs) { matched = await findPaymentByRef(r); if (matched) break; }

        if (!matched) {
            outcome = { ok: true, ignored: 'unknown reference' };
        } else if (eventName === 'payment.succeeded') {
            outcome = await applyPaidPayment(matched.reference, {
                providerId: typeof evt?.data?.id === 'string' ? evt.data.id : undefined,
                transactionId: evt?.data?.transaction_id || evt?.data?.reference || undefined,
                amount: eventAmount(evt),
            });
        } else if (eventName === 'payment.failed') {
            const pRef = db.doc(`companies/${matched.companyId}/payments/${matched.reference}`);
            const cur = await pRef.get();
            if (cur.exists && cur.get('status') === 'pending') await pRef.update({ status: 'failed', updatedAt: new Date().toISOString() });
            outcome = { ok: true };
        } else if (eventName === 'payment.refunded') {
            // não se retira a subscrição sozinho: fica registado para decisão humana
            await db.doc(`companies/${matched.companyId}/payments/${matched.reference}`).set({ refundedAt: new Date().toISOString() }, { merge: true });
            outcome = { ok: true, note: 'refund recorded' };
        }
    } catch (e: any) {
        console.error('ZumboPay webhook error', e);
        await db.collection('billingEvents').add({ receivedAt: new Date().toISOString(), event: eventName, refs, error: String(e?.message || e).slice(0, 300) }).catch(() => { });
        return NextResponse.json({ error: 'processing failed' }, { status: 500 }); // a ZumboPay repete
    }

    // A documentação não descreve o corpo dos eventos: guarda-se (sem números de telefone) para confirmar o formato.
    await db.collection('billingEvents').add({
        receivedAt: new Date().toISOString(), event: eventName, refs, matched: matched?.reference || null, outcome,
        payload: raw.replace(/\d{9,}/g, '***').slice(0, 4000),
    }).catch(() => { });
    return NextResponse.json(outcome);
}
