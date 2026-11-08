// Códigos de convite/desconto — lógica pura (sem os códigos: esses ficam só no servidor, em coupons-server.ts).
// Um código dá um preço mensal especial nos primeiros N meses pagos do plano Mensal. O preço cobrado é sempre
// calculado no servidor; o que fica na empresa (coupon) serve só para mostrar e lembrar.

export type CouponDef = {
    /** preço por mês com o código (MZN) */
    price: number;
    /** quantos meses pagos com este preço */
    months: number;
    /** só para testar pagamentos */
    test?: boolean;
};

/** O que fica gravado na empresa (pelo servidor), para mostrar e lembrar. */
export type CompanyCoupon = { code: string; price: number; months: number; monthsUsed: number; appliedAt?: string };

/** "  mjtp86 " → "MJTP86" (maiúsculas, sem espaços). */
export const normalizeCode = (raw: string) => String(raw || "").trim().toUpperCase().replace(/\s+/g, "");

/** Os planos onde o código vale: o preço é por mês, por isso só o Mensal. */
export const COUPON_PLANS = ["mensal"] as const;

/**
 * Quanto se paga com o código neste plano. `amount` null = o código não se aplica (outro plano, ou os meses
 * com desconto já foram todos usados) — paga-se o preço normal.
 */
export function couponAmount(def: CouponDef | undefined | null, monthsUsed: number, planId: string): { amount: number | null; monthsLeft: number } {
    if (!def) return { amount: null, monthsLeft: 0 };
    const monthsLeft = Math.max(0, def.months - Math.max(0, monthsUsed || 0));
    if (!monthsLeft || !(COUPON_PLANS as readonly string[]).includes(planId)) return { amount: null, monthsLeft };
    return { amount: def.price, monthsLeft };
}

/** Meses com desconto que ainda faltam (0 = acabou). */
export const couponMonthsLeft = (c?: CompanyCoupon | null) => (c ? Math.max(0, (c.months || 0) - (c.monthsUsed || 0)) : 0);

/** O lembrete: "Código MJTP86: 450 MT/mês nos primeiros 3 meses (faltam 2)". null se não há desconto a usar. */
export function couponReminder(c: CompanyCoupon | null | undefined, fmt: (n: number) => string = (n) => `${n} MT`): string | null {
    const left = couponMonthsLeft(c);
    if (!c || !left) return null;
    const first = c.months === 1 ? "no primeiro mês" : `nos primeiros ${c.months} meses`;
    const rest = c.monthsUsed > 0 ? ` (faltam ${left} ${left === 1 ? "mês" : "meses"})` : "";
    return `Código ${c.code}: ${fmt(c.price)}/mês ${first}${rest}`;
}
