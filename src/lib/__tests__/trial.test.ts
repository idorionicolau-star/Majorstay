import { describe, expect, it } from 'vitest';
import { canRestartTrial, trialEndFrom, trialMessage, trialTone } from '../trial';
import { TRIAL_DAYS } from '../plans';

describe('canRestartTrial: um reinício, só para quem está em teste e nunca pagou', () => {
    it('empresa em teste, ainda não reiniciada', () => {
        expect(canRestartTrial({ status: 'trial' })).toBe(true);
        expect(canRestartTrial({ status: 'trial', paidUntilMs: null, subscriptionEndsAt: null })).toBe(true);
    });
    it('só uma vez', () => {
        expect(canRestartTrial({ status: 'trial', trialRestartedAt: '2026-10-02T10:00:00Z' })).toBe(false);
    });
    it('nunca toca em quem pagou, foi suspenso ou não tem estado', () => {
        expect(canRestartTrial({ status: 'active' })).toBe(false);
        expect(canRestartTrial({ status: 'suspended' })).toBe(false);
        expect(canRestartTrial({})).toBe(false);
        expect(canRestartTrial({ status: 'trial', paidUntilMs: 1_800_000_000_000 })).toBe(false);
        expect(canRestartTrial({ status: 'trial', subscriptionEndsAt: '2026-12-01T00:00:00Z' })).toBe(false);
        expect(canRestartTrial(null)).toBe(false);
    });
});

describe('trialEndFrom', () => {
    it('14 dias por defeito', () => {
        expect(TRIAL_DAYS).toBe(14);
        const now = new Date('2026-10-02T10:00:00Z');
        expect(trialEndFrom(now).toISOString().slice(0, 10)).toBe('2026-10-16');
        expect(now.toISOString()).toBe('2026-10-02T10:00:00.000Z'); // não altera a data recebida
    });
});

describe('aviso do teste', () => {
    it('fica mais forte perto do fim', () => {
        expect(trialTone(14)).toBe('calm');
        expect(trialTone(8)).toBe('calm');
        expect(trialTone(7)).toBe('soon');
        expect(trialTone(4)).toBe('soon');
        expect(trialTone(3)).toBe('urgent');
        expect(trialTone(0)).toBe('urgent');
    });
    it('texto claro e no singular quando falta 1 dia', () => {
        expect(trialMessage(1)).toContain('1 dia');
        expect(trialMessage(0)).toContain('hoje');
        expect(trialMessage(3)).toContain('só em leitura');
        expect(trialMessage(10)).toContain('período de teste');
    });
});

import { isSnoozed, trialSnoozeMs } from '@/lib/trial';

describe('fechar o aviso do teste', () => {
    it('esconde um dia enquanto falta muito, 5 horas na última semana', () => {
        expect(trialSnoozeMs(12)).toBe(24 * 3_600_000);
        expect(trialSnoozeMs(6)).toBe(5 * 3_600_000);
        expect(trialSnoozeMs(1)).toBe(5 * 3_600_000);
    });
    it('volta a aparecer quando o tempo passa', () => {
        expect(isSnoozed(2_000, 1_000)).toBe(true);
        expect(isSnoozed(1_000, 2_000)).toBe(false);
        expect(isSnoozed(null, 1_000)).toBe(false);
    });
});
