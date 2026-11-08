export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { findAnyCode } from '@/lib/affiliates-server';
import { couponMonthsLeft, normalizeCode, type CompanyCoupon } from '@/lib/coupon-core';
import { escapeHtml } from '@/lib/daily-report';
import { SUPPORT } from '@/lib/support';
import type { CompanyAffiliate } from '@/lib/affiliate-core';

/**
 * Aplica um código à empresa de quem está autenticado (registo por convite ou página de Subscrição).
 * - Código de desconto (fixo ou de um afiliado que dá desconto): grava na empresa o código, o preço e os meses — só
 *   para mostrar e lembrar; o preço cobrado é calculado de novo no checkout, no servidor.
 * - Código de afiliado: liga a empresa ao afiliado (o primeiro fica — nunca se troca) e avisa o dono por email.
 */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const companyId: string | undefined = decoded.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 400 });

    const { code: raw } = await req.json().catch(() => ({}));
    const found = await findAnyCode(String(raw || ''));
    if (!found) return NextResponse.json({ error: 'Código inválido.' }, { status: 404 });

    const db = initializeAdmin().firestore();
    const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (!['Admin', 'Dono'].includes(emp.get('role')) && !decoded.superAdmin) {
        return NextResponse.json({ error: 'Só o administrador da empresa pode usar um código.' }, { status: 403 });
    }

    const companyRef = db.doc(`companies/${companyId}`);
    const companySnap = await companyRef.get();
    const update: Record<string, unknown> = {};
    let coupon: CompanyCoupon | null = null;

    if (found.def) {
        const current = companySnap.get('coupon') as CompanyCoupon | undefined;
        // um código já a meio (com meses pagos e ainda com desconto) não se troca por outro
        if (current?.code && normalizeCode(current.code) !== found.code && (current.monthsUsed || 0) > 0 && couponMonthsLeft(current) > 0) {
            return NextResponse.json({ error: `Já está a usar o código ${current.code}.` }, { status: 409 });
        }
        const paid = await db.collection(`companies/${companyId}/payments`).where('coupon', '==', found.code).where('status', '==', 'paid').get();
        coupon = {
            code: found.code, price: found.def.price, months: found.def.months, monthsUsed: paid.size,
            appliedAt: current?.code === found.code && current.appliedAt ? current.appliedAt : new Date().toISOString(),
        };
        update.coupon = coupon;
    }

    let linked = false;
    if (found.affiliate && !companySnap.get('affiliate.code')) {
        const affiliate: CompanyAffiliate = { code: found.affiliate.code, name: found.affiliate.name, linkedAt: new Date().toISOString() };
        update.affiliate = affiliate;
        linked = true;
    }

    if (Object.keys(update).length) await companyRef.set(update, { merge: true });

    if (linked && found.affiliate) {
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            const a = found.affiliate;
            const c = companySnap.data() || {};
            const rows = [
                ['Afiliado', `${a.name} · ${a.phone} · código ${a.code}`],
                ['Empresa', String(c.name || companyId)],
                ['Email', String(decoded.email || '—')],
                ['Telefone', String(c.phone || '—')],
                ['Comissão', `${a.commissionPct}% durante ${a.commissionMonths} meses, a contar do 1.º pagamento`],
            ];
            const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#333;max-width:560px">
<h2 style="margin:0 0 12px">🤝 Nova empresa por afiliado</h2>
<table style="border-collapse:collapse;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:6px 8px;color:#64748b;border-bottom:1px solid #e2e8f0">${k}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0"><b>${escapeHtml(v)}</b></td></tr>`).join('')}</table>
<p style="margin-top:16px"><a href="https://stock.majorgroup.app/admin/subscriptions" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ver afiliados</a></p></div>`;
            try {
                const res: any = await new Resend(apiKey).emails.send({ from: 'Major Assistant <assistant@majorgroup.app>', to: [SUPPORT.email], subject: `🤝 Nova empresa pelo afiliado ${a.name}: ${c.name || ''}`, html });
                if (res?.error) console.error('affiliate email', res.error);
            } catch (e) { console.error('affiliate email', e); }
        }
    }

    return NextResponse.json({ coupon, monthsLeft: coupon ? couponMonthsLeft(coupon) : 0, affiliate: !!found.affiliate });
}
