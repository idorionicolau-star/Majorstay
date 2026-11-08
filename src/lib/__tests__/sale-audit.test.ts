import { describe, it, expect } from 'vitest';
import { diffSale, changesToUpdate, sellerBlockedFields } from '../sale-audit';
import type { Sale } from '../types';

const sale = { id: 's1', productName: 'Cimento', quantity: 5, unitPrice: 100, totalValue: 500, amountPaid: 100, date: '2026-06-01T10:00:00Z', status: 'Pago' } as unknown as Sale;

describe('sale-audit', () => {
    it('diff só traz o que mudou', () => {
        const d = diffSale(sale, { ...sale, amountPaid: 500 });
        expect(Object.keys(d)).toEqual(['amountPaid']);
        expect(d.amountPaid).toEqual({ de: 100, para: 500 });
    });

    it('mesma data em formato diferente não conta como mudança', () => {
        expect(diffSale(sale, { date: '2026-06-01T10:00:00.000Z' })).toEqual({});
    });

    it('nota vazia onde não havia nota não conta como mudança, apagar uma nota conta', () => {
        expect(diffSale(sale, { notes: '' })).toEqual({});
        expect(diffSale({ ...sale, notes: 'pagar sexta' }, { notes: '' })).toEqual({ notes: { de: 'pagar sexta', para: '' } });
    });

    it('changesToUpdate troca undefined por null (Firestore não aceita undefined)', () => {
        expect(changesToUpdate({ note: { de: 'x', para: undefined } })).toEqual({ note: null });
    });

    it('vendedor não pode mexer em quantidade/preço/total, mas pode registar pagamento', () => {
        expect(sellerBlockedFields({ amountPaid: { de: 1, para: 2 }, status: {} })).toEqual([]);
        expect(sellerBlockedFields({ quantity: {}, totalValue: {}, amountPaid: {} }).sort()).toEqual(['quantity', 'totalValue']);
    });
});
