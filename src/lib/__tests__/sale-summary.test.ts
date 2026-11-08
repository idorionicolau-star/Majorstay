import { describe, expect, it } from 'vitest';
import { itemsSummary, saleLines } from '../sale-summary';

describe('resumo de uma venda com vários produtos', () => {
    it('um, dois ou vários produtos', () => {
        expect(itemsSummary(['Cimento'])).toBe('Cimento');
        expect(itemsSummary(['Cimento', 'Areia'])).toBe('Cimento e mais 1 produto');
        expect(itemsSummary(['Cimento', 'Areia', 'Bloco', 'Tinta'])).toBe('Cimento e mais 3 produtos');
        expect(itemsSummary([])).toBe('Venda');
    });
    it('todas as linhas da venda vão para o email', () => {
        const l = saleLines([
            { productName: 'Cimento', quantity: 2, unit: 'saco', totalValue: 1200 },
            { productName: 'Areia', quantity: 1, unit: 'm3', totalValue: 800 },
        ]);
        expect(l).toEqual([
            { productName: 'Cimento', quantity: 2, unit: 'saco', subtotal: 1200 },
            { productName: 'Areia', quantity: 1, unit: 'm3', subtotal: 800 },
        ]);
    });
});
