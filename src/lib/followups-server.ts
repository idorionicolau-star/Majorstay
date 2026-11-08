import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebase-admin';
import { TRIAL_DAYS } from '@/lib/plans';
import { countEvery, latestActivity, type CompanyFacts } from '@/lib/followups-core';

// Emails de acompanhamento — a parte que fala com o Firestore (ver lib/followups-core.ts).

const secret = () => process.env.CRON_SECRET || '';

/** Assinatura do link "não quero receber dicas" (sem login: o link no email basta). */
export function unsubscribeToken(companyId: string): string {
    return createHmac('sha256', secret()).update(`unsub:${companyId}`).digest('hex').slice(0, 32);
}

export function checkUnsubscribeToken(companyId: string, token: string): boolean {
    if (!secret() || !companyId || typeof token !== 'string' || token.length !== 32) return false;
    return timingSafeEqual(Buffer.from(token), Buffer.from(unsubscribeToken(companyId)));
}

const iso = (v: any): string | null => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    return null;
};

/** Os factos de uma empresa para decidir o próximo email. */
export async function companyFacts(db: Firestore, c: DocumentSnapshot, now = new Date()): Promise<CompanyFacts> {
    const d = c.data() || {};
    const ref = c.ref;
    const every = countEvery(d.countEveryDays);
    const since = new Date(now.getTime() - every * 86_400_000);

    const [products, sales, moves, log] = await Promise.all([
        ref.collection('products').limit(5).get(),
        // a venda mais recente: diz se já vendeu e quando trabalhou pela última vez (vendas feitas offline incluídas)
        ref.collection('sales').orderBy('date', 'desc').limit(1).get(),
        // só um campo ordenado (sem índice composto): as movimentações do período, procura-se uma contagem
        ref.collection('stockMovements').where('timestamp', '>=', since).orderBy('timestamp', 'desc').limit(2000).get(),
        ref.collection('followups').get(),
    ]);
    const counted = moves.docs.some((m) => m.get('isAudit') === true);
    const sent: Record<string, string> = {};
    log.docs.forEach((x) => { const at = x.get('sentAt'); if (typeof at === 'string') sent[x.id] = at; });

    // início: o registo/reinício do teste; sem isso, o fim do teste menos os dias de teste
    const trialEnd = d.trialEndsAt ? new Date(d.trialEndsAt) : null;
    const startedAt = iso(d.createdAt) || d.trialRestartedAt
        || (trialEnd && !isNaN(trialEnd.getTime()) ? new Date(trialEnd.getTime() - TRIAL_DAYS * 86_400_000).toISOString() : null);

    return {
        status: d.status,
        trialEndsAt: d.trialEndsAt || null,
        subscriptionEndsAt: d.subscriptionEndsAt || null,
        startedAt,
        lastActiveAt: latestActivity(d.lastActiveAt, [iso(sales.docs[0]?.get('date')), iso(moves.docs[0]?.get('timestamp'))], now),
        hasProducts: products.docs.some((p) => !p.get('deletedAt')),
        hasSale: !sales.empty,
        // muitas movimentações e nenhuma contagem entre elas: não se sabe — não lembra
        countedRecently: counted ? true : moves.size >= 2000 ? null : false,
        countEveryDays: every,
        tipsAllowed: d.emailTips !== false,
        sent,
    };
}

/** Para quem vai: os administradores (Admin/Dono) com email; senão, o dono da conta. */
export async function companyRecipients(db: Firestore, c: DocumentSnapshot): Promise<{ emails: string[]; name: string | null }> {
    const emps = await c.ref.collection('employees').where('role', 'in', ['Admin', 'Dono']).get();
    const emails = new Set<string>();
    let name: string | null = null;
    emps.docs.forEach((e) => {
        const em = String(e.get('email') || '').trim().toLowerCase();
        if (em.includes('@')) { emails.add(em); if (!name) name = e.get('username') || null; }
    });
    const ownerId = c.get('ownerId');
    if (!emails.size && ownerId) {
        try {
            const u = await initializeAdmin().auth().getUser(ownerId);
            if (u.email) emails.add(u.email.toLowerCase());
            name = name || u.displayName || null;
        } catch { /* sem dono: não envia */ }
    }
    return { emails: [...emails].slice(0, 3), name };
}
