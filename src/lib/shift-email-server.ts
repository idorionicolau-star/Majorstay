import 'server-only';
import { Resend } from 'resend';
import { BRAND } from '@/lib/brand';
import { initializeAdmin } from '@/lib/firebase-admin';
import { companyRecipients } from '@/lib/followups-server';
import { shiftCloseEmail, type ShiftCloseInfo } from '@/lib/shift-email';

/** Envia ao gerente/dono o resumo do turno que acabou de fechar. Nunca lança erro: fechar o turno não pode falhar por causa do email. */
export async function sendShiftCloseEmail(companyId: string, info: Omit<ShiftCloseInfo, 'company' | 'brand' | 'appUrl'>): Promise<void> {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) return;
        const db = initializeAdmin().firestore();
        const c = await db.doc(`companies/${companyId}`).get();
        if (!c.exists) return;
        const { emails } = await companyRecipients(db, c);
        if (!emails.length) return;
        const mail = shiftCloseEmail({ ...info, company: String(c.get('name') || 'a empresa'), brand: BRAND.name, appUrl: BRAND.appUrl });
        const res: any = await new Resend(apiKey).emails.send({ from: `${BRAND.name} <assistant@majorgroup.app>`, to: emails, subject: mail.subject, html: mail.html });
        if (res?.error) console.error('[shift-email] recusado:', companyId, res.error);
    } catch (e) {
        console.error('[shift-email]', companyId, e);
    }
}
