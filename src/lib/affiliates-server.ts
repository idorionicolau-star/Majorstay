import 'server-only';
import { initializeAdmin } from '@/lib/firebase-admin';
import { findCoupon } from '@/lib/coupons-server';
import { normalizeCode, type CouponDef } from '@/lib/coupon-core';
import type { Affiliate } from '@/lib/affiliate-core';

/** Afiliado activo com este código (a colecção `affiliates` só é lida pelo servidor). */
export async function findAffiliate(raw: string): Promise<Affiliate | null> {
    const code = normalizeCode(raw);
    if (!code || code.includes('/')) return null;
    const snap = await initializeAdmin().firestore().doc(`affiliates/${code}`).get();
    if (!snap.exists) return null;
    const a = snap.data() as Affiliate;
    return a.active === false ? null : { ...a, code };
}

/**
 * Um código escrito no registo ou na Subscrição: um código fixo de desconto (coupons-server) ou o de um afiliado.
 * `def` = o desconto para o cliente (null se o afiliado não dá desconto); `affiliate` = quem trouxe o cliente.
 */
export async function findAnyCode(raw: string): Promise<{ code: string; def: CouponDef | null; affiliate: Affiliate | null } | null> {
    const fixed = findCoupon(raw);
    if (fixed) return { code: fixed.code, def: fixed.def, affiliate: null };
    const affiliate = await findAffiliate(raw);
    if (!affiliate) return null;
    const def = affiliate.clientPrice ? { price: affiliate.clientPrice, months: affiliate.clientMonths || 3 } : null;
    return { code: affiliate.code, def, affiliate };
}
