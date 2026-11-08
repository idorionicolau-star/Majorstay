import { describe, expect, it } from 'vitest';
import { posTotals } from '../pos-totals';

describe('contas da Venda Rápida', () => {
    it('sem desconto nem IVA: o total é o subtotal', () => {
        expect(posTotals(1000, '', '')).toMatchObject({ discount: 0, discountInput: undefined, vat: 0, total: 1000 });
    });
    it('desconto em MT, nunca maior que o subtotal', () => {
        expect(posTotals(1000, '150', '')).toMatchObject({ discount: 150, discountInput: { type: 'fixed', value: 150 }, total: 850 });
        expect(posTotals(100, '500', '').total).toBe(0);
    });
    it('desconto em %', () => {
        expect(posTotals(1000, '10%', '')).toMatchObject({ discount: 100, discountInput: { type: 'percentage', value: 10 }, total: 900 });
    });
    it('IVA sobre o valor já com desconto (como no planBulkSale)', () => {
        const t = posTotals(1000, '10%', '16');
        expect(t.vatPercentage).toBe(16);
        expect(t.vat).toBeCloseTo(144);
        expect(t.total).toBeCloseTo(1044);
        expect(posTotals(1000, '', '16%').total).toBeCloseTo(1160);
    });
});
