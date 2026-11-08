import { describe, expect, it } from 'vitest';
import { planById } from '../plans';

describe('preços dos planos', () => {
    it('Mensal 1000 MT; Trimestral e Anual mantêm a poupança de 10% e 15%', () => {
        const m = planById('mensal')!.amount;
        expect(m).toBe(1000);
        expect(Math.round((1 - planById('trimestral')!.amount / (m * 3)) * 100)).toBe(10);
        expect(Math.round((1 - planById('anual')!.amount / (m * 12)) * 100)).toBe(15);
    });
});
