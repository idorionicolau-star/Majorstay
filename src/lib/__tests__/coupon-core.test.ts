import { describe, it, expect } from 'vitest';
import { couponAmount, couponMonthsLeft, couponReminder, normalizeCode } from '@/lib/coupon-core';

const def = { price: 450, months: 3 };

describe('códigos de convite', () => {
    it('normaliza o código', () => {
        expect(normalizeCode('  mjtp86 ')).toBe('MJTP86');
        expect(normalizeCode('ChrisKillyan2224')).toBe('CHRISKILLYAN2224');
    });
    it('preço com o código só no plano Mensal e só nos meses que faltam', () => {
        expect(couponAmount(def, 0, 'mensal')).toEqual({ amount: 450, monthsLeft: 3 });
        expect(couponAmount(def, 2, 'mensal')).toEqual({ amount: 450, monthsLeft: 1 });
        expect(couponAmount(def, 3, 'mensal')).toEqual({ amount: null, monthsLeft: 0 });
        expect(couponAmount(def, 0, 'trimestral')).toEqual({ amount: null, monthsLeft: 3 });
        expect(couponAmount(undefined, 0, 'mensal')).toEqual({ amount: null, monthsLeft: 0 });
    });
    it('lembrete', () => {
        const c = { code: 'MJTP86', price: 450, months: 3, monthsUsed: 0 };
        expect(couponReminder(c)).toBe('Código MJTP86: 450 MT/mês nos primeiros 3 meses');
        expect(couponReminder({ ...c, monthsUsed: 1 })).toBe('Código MJTP86: 450 MT/mês nos primeiros 3 meses (faltam 2 meses)');
        expect(couponReminder({ ...c, monthsUsed: 2 })).toContain('(faltam 1 mês)');
        expect(couponReminder({ ...c, monthsUsed: 3 })).toBeNull();
        expect(couponReminder({ code: 'X', price: 25, months: 1, monthsUsed: 0 })).toBe('Código X: 25 MT/mês no primeiro mês');
        expect(couponMonthsLeft(null)).toBe(0);
    });
});
