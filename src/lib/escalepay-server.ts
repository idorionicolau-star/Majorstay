import 'server-only';
import { initializeAdmin } from '@/lib/firebase-admin';
import { GRACE_DAYS } from '@/lib/plans';
import { ESCALEPAY_SOURCE, extendFrom, isEmail, normEmail, planForMonths, saleIdFor, saleMonths } from '@/lib/escalepay-core';

// Vendas da EscalePay (ver lib/escalepay-core.ts). Coleção `escalepaySales` — só o servidor (Admin SDK) lhe acede.

export type SaleSource = 'manual' | 'email';
export type SaleResult = {
    email: string;
    saleId: string;
    status: 'activated' | 'pending' | 'duplicate' | 'invalid';
    companyName?: string;
    until?: string;
};

const db = () => initializeAdmin().firestore();

/** A empresa cujo ADMINISTRADOR (Admin ou Dono) entra com este email — ou null (ainda não se registou). */
export async function companyForEmail(email: string): Promise<{ companyId: string; uid: string } | null> {
    const admin = initializeAdmin();
    let uid: string;
    try { uid = (await admin.auth().getUserByEmail(email)).uid; } catch { return null; }
    const companyId = (await db().doc(`users/${uid}`).get()).get('companyId');
    if (!companyId) return null;
    const role = (await db().doc(`companies/${companyId}/employees/${uid}`).get()).get('role');
    return ['Admin', 'Dono'].includes(role) ? { companyId, uid } : null;
}

/**
 * Aplica à empresa as vendas ainda por usar deste email: cada uma prolonga a subscrição pelos seus meses
 * (a partir do fim actual, se ainda estiver activa) e fica registada no histórico de pagamentos.
 */
export async function claimSales(companyId: string, email: string, now = new Date()): Promise<{ applied: number; until?: string; companyName?: string }> {
    const e = normEmail(email);
    if (!isEmail(e)) return { applied: 0 };
    const store = db();
    const companyRef = store.doc(`companies/${companyId}`);
    const pending = store.collection('escalepaySales').where('email', '==', e).where('claimedBy', '==', null);
    return store.runTransaction(async (tx) => {
        const [qs, cs] = await Promise.all([tx.get(pending), tx.get(companyRef)]);
        if (qs.empty || !cs.exists) return { applied: 0 };
        const c = cs.data() || {};
        const companyName: string = c.name || '';
        let endIso: string | undefined = c.subscriptionEndsAt;
        let lastMonths = 1;
        const sales = qs.docs.sort((a, b) => String(a.get('createdAt')).localeCompare(String(b.get('createdAt'))));
        for (const s of sales) {
            const months = saleMonths(s.get('months'));
            const { start, end } = extendFrom(now, endIso, months);
            endIso = end.toISOString();
            lastMonths = months;
            tx.set(store.doc(`companies/${companyId}/payments/escalepay-${s.id}`), {
                reference: `escalepay-${s.id}`,
                planId: 'EscalePay',
                provider: ESCALEPAY_SOURCE,
                amount: Number(s.get('amount')) || 0,
                months,
                status: 'paid',
                buyerEmail: e,
                createdAt: s.get('createdAt') || now.toISOString(),
                paidAt: now.toISOString(),
                periodStart: start.toISOString(),
                periodEnd: endIso,
            });
            tx.update(s.ref, { claimedBy: companyId, claimedAt: now.toISOString(), companyName, until: endIso });
        }
        const plan = planForMonths(lastMonths);
        tx.set(companyRef, {
            status: 'active',
            source: c.source || ESCALEPAY_SOURCE,
            ...(plan ? { plan } : {}),
            subscriptionEndsAt: endIso,
            // cópia numérica para as regras do Firestore: fim + tolerância (como nos pagamentos normais)
            paidUntilMs: new Date(endIso!).getTime() + GRACE_DAYS * 86_400_000,
        }, { merge: true });
        return { applied: sales.length, until: endIso, companyName };
    });
}

/**
 * Regista uma venda (idempotente: a mesma venda duas vezes não dá meses a dobrar) e, se o comprador já tiver
 * conta de administrador, activa logo a empresa. Senão fica à espera: activa-se quando ele se registar.
 */
export async function recordSale(input: { email: string; months?: number; ref?: string; amount?: number; source: SaleSource; by?: string }, now = new Date()): Promise<SaleResult> {
    const email = normEmail(input.email);
    const saleId = saleIdFor(email, input.ref, now);
    if (!isEmail(email)) return { email, saleId, status: 'invalid' };
    const store = db();
    const ref = store.doc(`escalepaySales/${saleId}`);
    const created = await store.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) return false;
        tx.set(ref, {
            email,
            months: saleMonths(input.months),
            amount: Number(input.amount) || 0,
            ref: input.ref || null,
            source: input.source,
            by: input.by || null,
            createdAt: now.toISOString(),
            claimedBy: null,
        });
        return true;
    });
    if (!created) {
        const s = (await ref.get()).data() || {};
        return { email, saleId, status: 'duplicate', companyName: s.companyName, until: s.until };
    }
    const company = await companyForEmail(email);
    if (!company) return { email, saleId, status: 'pending' };
    const r = await claimSales(company.companyId, email, now);
    return r.applied ? { email, saleId, status: 'activated', companyName: r.companyName, until: r.until } : { email, saleId, status: 'pending' };
}

/** As últimas vendas, para o painel do administrador. */
export async function listSales(limit = 100) {
    const qs = await db().collection('escalepaySales').orderBy('createdAt', 'desc').limit(limit).get();
    return qs.docs.map((d) => {
        const s = d.data();
        return { id: d.id, email: s.email, months: s.months, source: s.source, createdAt: s.createdAt, claimedBy: s.claimedBy || null, companyName: s.companyName || null, until: s.until || null };
    });
}
