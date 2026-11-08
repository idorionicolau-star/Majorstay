export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';
import { zumbopay } from '@/lib/billing-server';

/**
 * Só para o super-administrador: confirma que a ZumboPay está bem configurada (chave, Merchant ID, carteiras e
 * webhook) chamando GET /merchant/validate. Nunca devolve chaves nem o segredo do webhook.
 */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const env = {
        ZUMBOPAY_API_KEY: !!process.env.ZUMBOPAY_API_KEY,
        ZUMBOPAY_MERCHANT_ID: !!process.env.ZUMBOPAY_MERCHANT_ID,
        ZUMBOPAY_WALLET_ID: !!process.env.ZUMBOPAY_WALLET_ID,
        ZUMBOPAY_WEBHOOK_SECRET: !!process.env.ZUMBOPAY_WEBHOOK_SECRET,
    };
    try {
        const r = await zumbopay<{ data: any }>('/merchant/validate');
        const d = r.data || {};
        return NextResponse.json({
            env,
            ready: !!d.ready,
            missing: d.missing || [],
            environment: d.merchant?.environment,
            scopes: d.merchant?.api_key?.scopes,
            wallets: Object.fromEntries(Object.entries(d.wallets || {}).map(([m, list]: [string, any]) => [m, (list || []).map((w: any) => ({ wallet_id: w.wallet_id, wallet_code: w.wallet_code, name: w.name }))])),
            webhook: d.webhook ? { url: d.webhook.url, events: d.webhook.events, is_active: d.webhook.is_active } : null,
        });
    } catch (e: any) {
        return NextResponse.json({ env, error: String(e?.message || e) }, { status: 502 });
    }
}
