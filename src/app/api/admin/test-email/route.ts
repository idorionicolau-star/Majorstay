export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { FOLLOWUP_CATALOG, followupEmail, type FollowupType } from '@/lib/followups-core';
import { unsubscribeToken } from '@/lib/followups-server';
import { runFollowups } from '@/lib/followups-run';
import { manualPaymentEmail } from '@/lib/manual-pay-core';
import { whatsappLink } from '@/lib/support';
import { formatCurrency } from '@/lib/utils';

const APP_URL = 'https://stock.majorgroup.app';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Super-administrador: quem receberia emails de acompanhamento hoje (nada é enviado). */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    return NextResponse.json(await runFollowups({ dry: true }));
}

/**
 * Super-administrador: envia um email de exemplo (ou todos) para o próprio email, com "[TESTE]" no assunto.
 * { type: <tipo do FOLLOWUP_CATALOG> | 'manual-payment' | 'all' }
 */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const to = decoded.email as string | undefined;
    if (!to) return NextResponse.json({ error: 'A sua conta não tem email.' }, { status: 400 });
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY não configurado na Vercel.' }, { status: 503 });

    const { type } = await req.json().catch(() => ({}));
    const known = new Set<string>(FOLLOWUP_CATALOG.map((f) => f.type));
    const types: string[] = type === 'all' ? [...FOLLOWUP_CATALOG.map((f) => f.type), 'manual-payment'] : [type];
    if (!types.every((t) => t === 'manual-payment' || known.has(t))) return NextResponse.json({ error: 'Tipo de email inválido.' }, { status: 400 });

    const db = initializeAdmin().firestore();
    const companyId: string | null = decoded.companyId || null;
    const company = companyId ? (await db.doc(`companies/${companyId}`).get()).get('name') || 'A sua empresa' : 'A sua empresa';
    const name = (decoded.name as string) || null;
    const resend = new Resend(apiKey);
    const sent: string[] = [];
    const failed: { type: string; error: string }[] = [];

    for (const t of types) {
        let mail: { subject: string; html: string };
        if (t === 'manual-payment') {
            mail = manualPaymentEmail({ company, email: 'cliente@exemplo.com', createdBy: 'Cliente de exemplo', plan: 'Mensal', amount: formatCurrency(1000), method: 'mpesa', reference: 'MSXTESTE', adminUrl: `${APP_URL}/admin/subscriptions` });
        } else {
            const f = FOLLOWUP_CATALOG.find((x) => x.type === t)!;
            mail = followupEmail({ type: t as FollowupType, kind: f.kind, key: `teste-${t}` }, {
                company, name, appUrl: APP_URL, whatsappUrl: whatsappLink('Olá, preciso de ajuda com o MajorStockX.'),
                // o link funciona de verdade para a empresa de quem testa (volta a ligar em Ajustes → Empresa)
                unsubscribeUrl: companyId ? `${APP_URL}/api/email/unsubscribe?c=${encodeURIComponent(companyId)}&t=${unsubscribeToken(companyId)}` : null,
                trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
                subscriptionEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
                countEveryDays: 30,
            });
        }
        try {
            const r: any = await resend.emails.send({ from: 'MajorStockX <assistant@majorgroup.app>', to: [to], subject: `[TESTE] ${mail.subject}`, html: mail.html });
            if (r?.error) throw new Error(r.error.message || String(r.error));
            sent.push(t);
        } catch (e: any) {
            failed.push({ type: t, error: String(e?.message || e).slice(0, 200) });
        }
        if (types.length > 1) await sleep(600); // limite do Resend: ~2 envios por segundo
    }
    return NextResponse.json({ to, sent, failed }, { status: failed.length && !sent.length ? 502 : 200 });
}
