/** Subscription plans (MZN) MajorStay Hospitality Suite. */
export type PlanId = "mensal" | "trimestral" | "anual";
export type Plan = { id: PlanId; label: string; months: number; amount: number; note?: string };

export const PLANS: Plan[] = [
    { id: "mensal", label: "Mensal", months: 1, amount: 1500 },
    { id: "trimestral", label: "Trimestral", months: 3, amount: 4050, note: "Poupa 10%" },
    { id: "anual", label: "Anual", months: 12, amount: 15300, note: "Poupa 15%" },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id);

/** Days of tolerance after the paid period ends before the account becomes read-only. */
export const GRACE_DAYS = 2;

/** Duração do teste gratuito de uma empresa nova (dias). */
export const TRIAL_DAYS = 14;
