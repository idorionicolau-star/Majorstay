import { describe, it, expect } from 'vitest';
import { saleIncome } from '@/lib/sale-filters';

describe('saleIncome', () => {
    it('venda a crédito por pagar não conta como receita', () => {
        expect(saleIncome({ amountPaid: 0, totalValue: 500 })).toBe(0);
    });
    it('pagamento parcial conta só o que foi pago', () => {
        expect(saleIncome({ amountPaid: 200, totalValue: 500 })).toBe(200);
    });
    it('venda antiga sem amountPaid conta por inteiro', () => {
        expect(saleIncome({ totalValue: 500 })).toBe(500);
    });
});
