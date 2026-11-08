import { describe, expect, it } from 'vitest';
import { expectedReserved, explainReserved, reservedDrifts } from '../reserved-stock';
import type { Order, Sale } from '../types';

const sale = (o: Partial<Sale>): Sale => ({ id: Math.random().toString(36), date: '2026-10-01', productId: 'x', productName: 'Bolacha', quantity: 1, unitPrice: 5, subtotal: 5, totalValue: 5, soldBy: 'a', guideNumber: 'VD-1', status: 'Pago', documentType: 'Venda a Dinheiro', ...o } as Sale);
const order = (o: Partial<Order>): Order => ({ id: Math.random().toString(36), productId: 'x', productName: 'Bolacha', quantity: 3, unit: 'un', status: 'Pendente', quantityProduced: 0, productionLogs: [], ...o } as Order);
const prod = (reservedStock: number, extra = {}) => ({ name: 'Bolacha', location: 'Principal', reservedStock, ...extra });

describe('de onde vem o reservado', () => {
    it('venda paga por levantar reserva', () => {
        const e = explainReserved(prod(2), [sale({ quantity: 2 })], [], false);
        expect(e.explained).toBe(2); expect(e.drift).toBe(0);
    });
    it('levantada, em proforma ou na lixeira não reserva', () => {
        const sales = [sale({ status: 'Levantado' }), sale({ documentType: 'Factura Proforma' }), sale({ deletedAt: 'x' }), sale({ status: 'Pendente' })];
        expect(explainReserved(prod(0), sales, [], false).explained).toBe(0);
    });
    it('encomenda activa reserva a quantidade registada (ou a toda nas antigas)', () => {
        expect(explainReserved(prod(5), [], [order({ quantity: 3, reservedQuantity: 5 })], false).explained).toBe(5);
        expect(explainReserved(prod(3), [], [order({ quantity: 3 })], false).explained).toBe(3);
        expect(explainReserved(prod(0), [], [order({ status: 'Entregue' }), order({ deletedAt: 'x' })], false).explained).toBe(0);
    });
    it('a venda ligada a uma encomenda não conta a dobrar', () => {
        const o = order({ id: 'o1', quantity: 4 });
        const e = explainReserved(prod(4), [sale({ orderId: 'o1', quantity: 4 })], [o], false);
        expect(e.explained).toBe(4); expect(e.drift).toBe(0);
    });
    it('reserva sem nada por trás = deriva positiva', () => {
        const e = explainReserved(prod(2), [], [], false);
        expect(e.explained).toBe(0); expect(e.drift).toBe(2); expect(e.sales).toEqual([]);
    });
    it('nome sem acentos/maiúsculas e "Principal" = sem local', () => {
        expect(explainReserved({ name: 'BOLACHA', location: '', reservedStock: 1 }, [sale({ location: 'Principal' })], [], true).explained).toBe(1);
    });
    it('com vários locais só conta o local do produto', () => {
        const sales = [sale({ location: 'loja', quantity: 2 }), sale({ location: 'armazem', quantity: 5 })];
        expect(explainReserved(prod(2, { location: 'loja' }), sales, [], true).explained).toBe(2);
        expect(explainReserved(prod(2, { location: 'loja' }), sales, [], false).explained).toBe(7); // um só local: todas
    });
    it('esperado por documento: repetidos ficam com a reserva toda no primeiro', () => {
        const docs = [{ id: 'a', name: 'Bolacha', location: 'Principal', reservedStock: 1 }, { id: 'b', name: 'Bolacha', location: '', reservedStock: 2 }, { id: 'c', name: 'Outra', location: 'Principal', reservedStock: 0, deletedAt: 'x' }];
        const r = expectedReserved(docs, [sale({ quantity: 3 })], [], false);
        expect(r).toEqual([{ id: 'a', current: 1, expected: 3 }, { id: 'b', current: 2, expected: 0 }]);
    });
    it('lista só os produtos com deriva', () => {
        const prods = [{ ...prod(2), id: '1' }, { name: 'Pão', location: 'Principal', reservedStock: 0, id: '2' }];
        const d = reservedDrifts(prods, [], [], false);
        expect(d.length).toBe(1); expect(d[0].drift).toBe(2);
    });
});
