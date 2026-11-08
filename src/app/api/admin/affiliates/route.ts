export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { staticCouponCodes } from '@/lib/coupons-server';
import { affiliateLink, checkAffiliate, clientCommission, type Affiliate } from '@/lib/affiliate-core';
import { planById } from '@/lib/plans';

/**
 * Afiliados (só o super-administrador). GET: a lista com as empresas de cada um, quantas pagam e a comissão.
 * POST: criar um afiliado. PATCH: activar / desactivar (um código desactivado deixa de ligar empresas novas).
 */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const db = initializeAdmin().firestore();
    const now = new Date();
    const affs = (await db.collection('affiliates').get()).docs.map((d) => ({ ...(d.data() as Affiliate), code: d.id }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    const out = await Promise.all(affs.map(async (a) => {
        const cos = await db.collection('companies').where('affiliate.code', '==', a.code).get();
        const companies = await Promise.all(cos.docs.map(async (c) => {
            const pays = (await db.collection(`companies/${c.id}/payments`).where('status', '==', 'paid').get()).docs.map((p) => p.data() as { amount: number; paidAt?: string; status?: string });
            const com = clientCommission(pays, a.commissionPct, a.commissionMonths, now);
            const paying = c.get('status') === 'active' && Number(c.get('paidUntilMs') || 0) > now.getTime();
            return { id: c.id, name: String(c.get('name') || c.id), status: String(c.get('status') || ''), linkedAt: String(c.get('affiliate.linkedAt') || ''), paying, ...com };
        }));
        companies.sort((x, y) => y.linkedAt.localeCompare(x.linkedAt));
        const sum = (k: 'commission' | 'thisMonth' | 'paidTotal') => Math.round(companies.reduce((t, c) => t + c[k], 0) * 100) / 100;
        return {
            ...a, link: affiliateLink(a.code), companies,
            totals: { companies: companies.length, paying: companies.filter((c) => c.paying).length, paidTotal: sum('paidTotal'), commission: sum('commission'), thisMonth: sum('thisMonth') },
        };
    }));
    return NextResponse.json({ affiliates: out });
}

export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const db = initializeAdmin().firestore();
    const taken = staticCouponCodes();
    (await db.collection('affiliates').select().get()).docs.forEach((d) => taken.add(d.id));
    const c = checkAffiliate(body || {}, taken, planById('mensal')?.amount || 1000);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    const affiliate: Affiliate = { ...c.value, active: true, createdAt: new Date().toISOString() };
    const ref = db.doc(`affiliates/${affiliate.code}`);
    // create() falha se o código já existir (dois pedidos ao mesmo tempo)
    try { await ref.create(affiliate); } catch { return NextResponse.json({ error: `O código ${affiliate.code} já existe.` }, { status: 409 }); }
    return NextResponse.json({ affiliate: { ...affiliate, link: affiliateLink(affiliate.code) } });
}

export async function PATCH(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const { code, active } = await req.json().catch(() => ({}));
    if (typeof code !== 'string' || !/^[A-Z0-9]{4,12}$/.test(code) || typeof active !== 'boolean') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    const ref = initializeAdmin().firestore().doc(`affiliates/${code}`);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Afiliado não encontrado.' }, { status: 404 });
    await ref.update({ active });
    return NextResponse.json({ ok: true, active });
}
