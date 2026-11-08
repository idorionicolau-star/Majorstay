import { describe, expect, it } from 'vitest';
import { isCountableSale, paidAfterEdit, saleCustomerId } from '../sale-filters';

describe('isCountableSale', () => {
    it('conta vendas normais', () => {
        expect(isCountableSale({ documentType: 'Venda a Dinheiro' })).toBe(true);
        expect(isCountableSale({ documentType: 'Encomenda' })).toBe(true);
        expect(isCountableSale({ documentType: 'Factura' })).toBe(true);
    });
    it('não conta propostas nem pró-formas', () => {
        expect(isCountableSale({ documentType: 'Cotação' })).toBe(false);
        expect(isCountableSale({ documentType: 'Factura Proforma' })).toBe(false);
    });
    it('não conta as apagadas (lixeira)', () => {
        expect(isCountableSale({ documentType: 'Venda a Dinheiro', deletedAt: '2026-10-02T10:00:00Z' })).toBe(false);
    });
});

describe('paidAfterEdit', () => {
    it('venda paga por inteiro: o pago acompanha o novo preço', () => {
        expect(paidAfterEdit({ totalValue: 1000, amountPaid: 1000 }, 800)).toBe(800);
        expect(paidAfterEdit({ totalValue: 1000, amountPaid: 1000 }, 1200)).toBe(1200);
        expect(paidAfterEdit({ totalValue: 1000 }, 900)).toBe(900); // antiga, sem amountPaid = paga
    });
    it('a crédito: o pago fica, mas nunca acima do novo total', () => {
        expect(paidAfterEdit({ totalValue: 1000, amountPaid: 300 }, 1200)).toBe(300);
        expect(paidAfterEdit({ totalValue: 1000, amountPaid: 300 }, 200)).toBe(200);
        expect(paidAfterEdit({ totalValue: 1000, amountPaid: 0 }, 500)).toBe(0);
    });
    it('encomenda: o que se escreveu', () => {
        expect(paidAfterEdit({ totalValue: 1000, amountPaid: 300 }, 1000, 650, true)).toBe(650);
    });
});

describe('saleCustomerId (de que cliente é a venda)', () => {
    const customers = [{ id: 'c1', name: 'Sr. Ngwenha' }, { id: 'c2', name: 'Mahete' }];
    it('usa o customerId quando existe', () => {
        expect(saleCustomerId({ customerId: 'c2', clientName: 'Sr. Ngwenha' }, customers)).toBe('c2');
    });
    it('encomendas antigas: só com o nome, sem distinguir maiúsculas nem espaços', () => {
        expect(saleCustomerId({ clientName: '  sr. ngwenha ' }, customers)).toBe('c1');
    });
    it('sem cliente ou nome desconhecido → nenhum', () => {
        expect(saleCustomerId({}, customers)).toBeNull();
        expect(saleCustomerId({ clientName: 'Outro' }, customers)).toBeNull();
    });
});
