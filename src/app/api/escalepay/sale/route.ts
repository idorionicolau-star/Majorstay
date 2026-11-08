export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { verifyIdToken } from '@/lib/firebase-admin';
import { listSales, recordSale, type SaleResult } from '@/lib/escalepay-server';
import { normEmail, saleMonths } from '@/lib/escalepay-core';

/** O script do Gmail (venda lida no email da EscalePay) autentica-se com o segredo ESCALEPAY_SECRET. */
function hasSecret(req: Request): boolean {
    const secret = process.env.ESCALEPAY_SECRET || '';
    const got = req.headers.get('x-escalepay-secret') || '';
    if (secret.length < 16 || got.length !== secret.length) return false;
    return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * Regista vendas da EscalePay.
 * - Script do Gmail (cabeçalho x-escalepay-secret): { email, ref, months?, amount? } — uma venda por email recebido.
 * - Super-administrador (painel): { emails: string[], months?, amount? } — a lista colada de compradores.
 */
export async function POST(req: Request) {
    const body = await req.json().catch(() => ({} as any));
    if (hasSecret(req)) {
        const r = await recordSale({ email: String(body.email || ''), ref: body.ref ? String(body.ref) : undefined, months: body.months, amount: body.amount, source: 'email' });
        return NextResponse.json(r, { status: r.status === 'invalid' ? 400 : 200 });
    }
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const emails: string[] = Array.isArray(body.emails) ? [...new Set(body.emails.map((e: unknown) => normEmail(String(e))))] as string[] : [];
    if (!emails.length) return NextResponse.json({ error: 'Nenhum email.' }, { status: 400 });
    if (emails.length > 200) return NextResponse.json({ error: 'No máximo 200 emails de cada vez.' }, { status: 400 });
    const results: SaleResult[] = [];
    for (const email of emails) results.push(await recordSale({ email, months: saleMonths(body.months), amount: body.amount, source: 'manual', by: decoded.email }));
    return NextResponse.json({ results });
}

/** As últimas vendas (só o super-administrador). */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    return NextResponse.json({ sales: await listSales() });
}
