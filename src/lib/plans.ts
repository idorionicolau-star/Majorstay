/** Subscription plans (MZN). A comissão da ZumboPay (8%) é absorvida pela MajorStockX. */
export type PlanId = "mensal" | "trimestral" | "anual";
export type Plan = { id: PlanId; label: string; months: number; amount: number; note?: string };

export const PLANS: Plan[] = [
    { id: "mensal", label: "Mensal", months: 1, amount: 1000 },
    { id: "trimestral", label: "Trimestral", months: 3, amount: 2700, note: "Poupa 10%" },
    { id: "anual", label: "Anual", months: 12, amount: 10200, note: "Poupa 15%" },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id);

/** Days of tolerance after the paid period ends before the account becomes read-only. */
export const GRACE_DAYS = 2;

/** Duração do teste gratuito de uma empresa nova (dias). Um único sítio: registo com email, registo com Google e reinício. */
export const TRIAL_DAYS = 14;
