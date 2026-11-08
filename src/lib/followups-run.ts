import 'server-only';
import { Resend } from 'resend';
import { initializeAdmin } from '@/lib/firebase-admin';
import { followupEmail, nextFollowup } from '@/lib/followups-core';
import { companyFacts, companyRecipients, unsubscribeToken } from '@/lib/followups-server';
import { whatsappLink } from '@/lib/support';

const APP_URL = 'https://stock.majorgroup.app';
/** O plano gratuito do Resend dá 100 emails/dia (o relatório diário também usa): fica margem. */
const MAX_PER_RUN = 60;

/**
 * Emails de acompanhamento: para cada empresa, no máximo um email — prazos do teste e da subscrição, primeiros
 * passos, falta de uso, contagem do stock (ver lib/followups-core.ts). Corre uma vez por dia, a seguir ao relatório
 * do fim do dia (/api/cron/end-of-day); /api/cron/followups corre-o à mão (?dry=1 mostra sem enviar).
 */
export async function runFollowups({ dry = false }: { dry?: boolean } = {}) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey && !dry) return { skipped: 'RESEND_API_KEY não configurado' };
    const resend = apiKey ? new Resend(apiKey) : null;

    const db = initializeAdmin().firestore();
    const now = new Date();
    const companies = await db.collection('companies').get();
    const planned: { companyId: string; companyName: string; type: string; to: string[] }[] = [];
    const failed: string[] = [];
    let sentCount = 0;

    for (const c of companies.docs) {
        if (sentCount >= MAX_PER_RUN) break;
        try {
            const facts = await companyFacts(db, c, now);
            const next = nextFollowup(facts, now);
            if (!next) continue;
            const { emails, name } = await companyRecipients(db, c);
            if (!emails.length) continue;
            planned.push({ companyId: c.id, companyName: c.get('name') || c.id, type: next.type, to: emails });
            if (dry) continue;

            const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe?c=${encodeURIComponent(c.id)}&t=${unsubscribeToken(c.id)}`;
            const mail = followupEmail(next, {
                company: c.get('name') || 'a sua empresa', name, appUrl: APP_URL,
                whatsappUrl: whatsappLink('Olá, preciso de ajuda com o MajorStockX.'),
                unsubscribeUrl,
                trialEndsAt: facts.trialEndsAt, subscriptionEndsAt: facts.subscriptionEndsAt, countEveryDays: facts.countEveryDays,
            });
            const res: any = await resend!.emails.send({
                from: 'MajorStockX <assistant@majorgroup.app>', to: emails, subject: mail.subject, html: mail.html,
                // dicas: o Gmail e outros mostram "Cancelar subscrição" ao lado do remetente
                ...(next.kind === 'tips' ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
            });
            // o Resend não lança erro: devolve-o — sem isto um email recusado ficava registado como enviado
            if (res?.error) throw new Error(res.error.message || String(res.error));
            await c.ref.collection('followups').doc(next.key).set({ type: next.type, kind: next.kind, sentAt: now.toISOString(), to: emails });
            sentCount++;
        } catch (e) {
            console.error('followup', c.id, e);
            failed.push(c.id);
        }
    }
    return { dry, companies: companies.size, sent: dry ? 0 : sentCount, planned, failed };
}
