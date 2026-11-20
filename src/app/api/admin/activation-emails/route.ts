export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { activatedToday, sendActivationEmail } from '@/lib/activation-email-server';

/**
 * Super-administrador: envia a confirmação de subscrição activada às empresas activadas hoje que ainda não a
 * receberam (uma só vez cada). `dry: true` só mostra a quem iria.
 */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const { dry } = await req.json().catch(() => ({}));
    const db = initializeAdmin().firestore();
    const companies = await activatedToday(db);
    const results: { companyId: string; name: string; sent: boolean; reason?: string; to?: string[] }[] = [];
    for (const c of companies) {
        const r = await sendActivationEmail(c.id, { dry: dry === true });
        results.push({ companyId: c.id, name: String(c.get('name') || c.id), ...r });
    }
    return NextResponse.json({ dry: dry === true, results, sent: results.filter((r) => r.sent).length });
}
