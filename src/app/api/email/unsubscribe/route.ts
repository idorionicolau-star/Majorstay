export const dynamic = 'force-dynamic';

import { initializeAdmin } from '@/lib/firebase-admin';
import { checkUnsubscribeToken } from '@/lib/followups-server';

const page = (title: string, text: string, status = 200) => new Response(
    `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 40px 16px;">
<div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
<h1 style="font-size: 20px; margin-top: 0;">${title}</h1><p style="line-height: 1.6; color: #334155;">${text}</p>
<p><a href="https://stock.majorgroup.app/settings" style="color: #2563eb;">Abrir o MajorStockX</a></p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

async function unsubscribe(req: Request) {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('c') || '';
    const token = url.searchParams.get('t') || '';
    if (!checkUnsubscribeToken(companyId, token) || companyId.includes('/')) {
        return page('Link inválido', 'Este link já não é válido. Pode desligar as dicas em Ajustes → Empresa.', 400);
    }
    await initializeAdmin().firestore().doc(`companies/${companyId}`).set({ emailTips: false }, { merge: true });
    return page('Feito', 'Não vai receber mais dicas e lembretes por email. Os avisos sobre o fim do teste ou da subscrição continuam a chegar. Pode voltar a ligar as dicas em Ajustes → Empresa.');
}

/** "Não quero receber estas dicas" (link no fim de cada email de dicas). */
export const GET = unsubscribe;
/** Saída com um clique dos clientes de email (List-Unsubscribe-Post). */
export const POST = unsubscribe;
