// Regras do teste gratuito, puras (sem Firebase) para poderem ser testadas.
import { TRIAL_DAYS } from '@/lib/plans';

type TrialCompany = {
    status?: string;
    trialRestartedAt?: string;
    paidUntilMs?: number | null;
    subscriptionEndsAt?: string | null;
};

/**
 * Uma empresa que já existia pode ter UM reinício do teste (14 dias a contar de agora). Só conta quem está em
 * teste: quem já pagou, quem foi suspenso e as empresas sem estado nunca são tocadas. E só uma vez.
 */
export function canRestartTrial(c: TrialCompany | null | undefined): boolean {
    if (!c || c.status !== 'trial') return false;
    if (c.trialRestartedAt) return false;
    if (c.paidUntilMs || c.subscriptionEndsAt) return false;
    return true;
}

export function trialEndFrom(now: Date, days = TRIAL_DAYS): Date {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + days);
    return d;
}

export type TrialTone = 'calm' | 'soon' | 'urgent';

/** Quanto mais perto do fim, mais forte o aviso: azul → âmbar (7 dias) → vermelho (3 dias). */
export function trialTone(daysLeft: number): TrialTone {
    if (daysLeft <= 3) return 'urgent';
    if (daysLeft <= 7) return 'soon';
    return 'calm';
}

export function trialMessage(daysLeft: number): string {
    if (daysLeft <= 0) return 'O seu teste gratuito termina hoje. Depois, a conta fica só em leitura — os seus dados ficam guardados.';
    if (daysLeft === 1) return 'Falta 1 dia para o fim do teste gratuito. Depois, a conta fica só em leitura — os seus dados ficam guardados.';
    if (daysLeft <= 3) return `Faltam ${daysLeft} dias para o fim do teste gratuito. Depois, a conta fica só em leitura — os seus dados ficam guardados.`;
    if (daysLeft <= 7) return `O teste gratuito termina em ${daysLeft} dias. Subscreva para não ficar sem poder registar vendas e stock.`;
    return 'Está no período de teste gratuito do MajorStockX.';
}

/**
 * Fechar o aviso do teste esconde-o por um tempo e depois volta: um dia enquanto falta muito,
 * 5 horas na última semana (quanto mais perto do fim, mais vezes lembra).
 */
export function trialSnoozeMs(daysLeft: number): number {
    return trialTone(daysLeft) === 'calm' ? 24 * 3_600_000 : 5 * 3_600_000;
}

/** O aviso está escondido agora? (`until` = até quando foi fechado, em ms) */
export function isSnoozed(until: number | null | undefined, now: number): boolean {
    return typeof until === 'number' && until > now;
}
