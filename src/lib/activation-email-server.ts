import 'server-only';
import { Resend } from 'resend';
import { FieldValue, type Firestore, type DocumentSnapshot } from 'firebase-admin/firestore';
import { BRAND } from '@/lib/brand';
import { initializeAdmin } from '@/lib/firebase-admin';
import { companyRecipients } from '@/lib/followups-server';
import { planById } from '@/lib/plans';
import { whatsappLink } from '@/lib/support';
import { activationEmailHtml } from '@/lib/activation-email';

export type ActivationResult = { sent: boolean; reason?: string; to?: string[] };

/**
 * Envia a confirmação de subscrição activada, uma só vez por empresa. Seguro de chamar várias vezes (pagamento,
 * EscalePay, painel do administrador): a marca `activationEmailSentAt` é reservada antes de enviar. Nunca lança erro.
 */
export async function sendActivationEmail(companyId: string, { dry = false }: { dry?: boolean } = {}): Promise<ActivationResult> {
    try {
        const db = initializeAdmin().firestore();
        const ref = db.doc(`companies/${companyId}`);
        const snap = await ref.get();
        if (!snap.exists) return { sent: false, reason: 'sem-empresa' };
        if (snap.get('status') !== 'active') return { sent: false, reason: 'nao-activa' };
        if (snap.get('activationEmailSentAt')) return { sent: false, reason: 'ja-enviado' };
        const { emails, name } = await companyRecipients(db, snap);
        if (!emails.length) return { sent: false, reason: 'sem-destinatario' };
        if (dry) return { sent: false, reason: 'dry', to: emails };
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) return { sent: false, reason: 'sem-chave-resend' };

        // reserva a marca (só um pedido a consegue) antes de enviar
        const claimed = await db.runTransaction(async (tx) => {
            const c = await tx.get(ref);
            if (c.get('activationEmailSentAt')) return false;
            tx.update(ref, { activationEmailSentAt: new Date().toISOString() });
            return true;
        });
        if (!claimed) return { sent: false, reason: 'ja-enviado' };

        const mail = activationEmailHtml({
            company: String(snap.get('name') || 'a sua empresa'), name, until: snap.get('subscriptionEndsAt') || null,
            planLabel: planById(snap.get('plan'))?.label || null, appUrl: BRAND.appUrl, brand: BRAND.name,
            whatsappUrl: whatsappLink(`Olá, preciso de ajuda com o ${BRAND.name}.`),
        });
        const res: any = await new Resend(apiKey).emails.send({ from: `${BRAND.name} <assistant@majorgroup.app>`, to: emails, subject: mail.subject, html: mail.html });
        if (res?.error) {
            await ref.update({ activationEmailSentAt: FieldValue.delete() }).catch(() => null);
            console.error('[activation-email] recusado:', companyId, res.error);
            return { sent: false, reason: 'recusado' };
        }
        return { sent: true, to: emails };
    } catch (e) {
        console.error('[activation-email]', companyId, e);
        return { sent: false, reason: 'erro' };
    }
}

const startOfTodayMaputo = (now = new Date()) => {
    const m = new Date(now.getTime() + 2 * 3600_000);
    return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate()) - 2 * 3600_000);
};

/** Empresas activas, sem confirmação enviada, e que foram activadas hoje (pagamento pago hoje ou activação no painel hoje). */
export async function activatedToday(db: Firestore, now = new Date()): Promise<DocumentSnapshot[]> {
    const since = startOfTodayMaputo(now).toISOString();
    const all = await db.collection('companies').where('status', '==', 'active').get();
    const out: DocumentSnapshot[] = [];
    for (const c of all.docs) {
        if (c.get('activationEmailSentAt')) continue;
        let today = String(c.get('adminUpdatedAt') || '') >= since;
        if (!today) {
            const paid = await c.ref.collection('payments').where('paidAt', '>=', since).limit(1).get();
            today = !paid.empty;
        }
        if (today) out.push(c);
    }
    return out;
}
