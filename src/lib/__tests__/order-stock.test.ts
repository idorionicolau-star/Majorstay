import { describe, expect, it } from 'vitest';
import { ingredientRequiredQty, orderDelivered, orderToDeliver, orderToProduce, planOrderReservation, planPartialDelivery, reservedToRelease } from '../order-stock';

describe('ingredientRequiredQty', () => {
    it('linear sem rendimento', () => {
        expect(ingredientRequiredQty({ quantity: 2 }, 10)).toBe(20);
    });
    it('com rendimento arredonda para cima (nunca meio saco)', () => {
        const saco = { quantity: 1, yieldPerUnit: 75 };
        expect(ingredientRequiredQty(saco, 150)).toBe(2);
        expect(ingredientRequiredQty(saco, 76)).toBe(2);
        expect(ingredientRequiredQty(saco, 75)).toBe(1);
        expect(ingredientRequiredQty({ quantity: 3, yieldPerUnit: 75 }, 76)).toBe(6);
    });
    it('rendimento inválido é ignorado', () => {
        expect(ingredientRequiredQty({ quantity: 2, yieldPerUnit: 0 }, 5)).toBe(10);
    });
});

describe('planOrderReservation', () => {
    it('fabricante reserva mesmo sem stock suficiente (vai produzir)', () => {
        expect(planOrderReservation({ stock: 5, reservedStock: 0 }, 100, true)).toEqual({ kind: 'reserve' });
    });
    it('fabricante: produto que ainda não existe no inventário é criado', () => {
        expect(planOrderReservation(null, 100, true)).toEqual({ kind: 'create' });
    });
    it('revendedor reserva só se o disponível chega', () => {
        expect(planOrderReservation({ stock: 50, reservedStock: 10 }, 40, false)).toEqual({ kind: 'reserve' });
        expect(planOrderReservation({ stock: 50, reservedStock: 10 }, 41, false)).toEqual({ kind: 'refuse', available: 40 });
    });
    it('revendedor sem o produto no inventário recusa', () => {
        expect(planOrderReservation(null, 1, false)).toEqual({ kind: 'refuse', available: 0 });
    });
    it('disponível negativo mostra 0', () => {
        expect(planOrderReservation({ stock: 5, reservedStock: 9 }, 1, false)).toEqual({ kind: 'refuse', available: 0 });
    });
});

describe('reservedToRelease', () => {
    it('liberta o que a encomenda reservou', () => {
        expect(reservedToRelease({ quantity: 10, reservedQuantity: 10 })).toBe(10);
        expect(reservedToRelease({ quantity: 10, reservedQuantity: 0 })).toBe(0);
    });
    it('encomendas antigas (sem o campo) mantêm a regra antiga', () => {
        expect(reservedToRelease({ quantity: 10 })).toBe(10);
    });
});

describe('levantamento parcial de encomendas', () => {
    it('100 encomendados, 30 já em stock, leva 30 → faltam produzir 70 e levar 70', () => {
        const order = { quantity: 100, quantityProduced: 0, reservedQuantity: 100 };
        const p = planPartialDelivery(order, 30, 30);
        expect(p).toEqual({ ok: true, quantityDelivered: 30, quantityProduced: 0, reservedQuantity: 70, releaseReserved: 30 });
        const after = { ...order, ...(p.ok ? p : {}) };
        expect(orderToDeliver(after)).toBe(70);
        expect(orderToProduce(after)).toBe(70);
    });

    it('o que foi produzido para a encomenda sai primeiro', () => {
        const p = planPartialDelivery({ quantity: 100, quantityProduced: 50, reservedQuantity: 100 }, 30, 80);
        expect(p.ok && p.quantityProduced).toBe(20);
        const after = { quantity: 100, quantityProduced: 20, quantityDelivered: 30 };
        expect(orderToProduce(after)).toBe(50);
        expect(orderDelivered(after)).toBe(30);
    });

    it('recusa: zero, mais do que há em stock, ou tudo o que falta (isso é "Entregar")', () => {
        const o = { quantity: 100, quantityProduced: 0, quantityDelivered: 60 };
        expect(planPartialDelivery(o, 0, 50).ok).toBe(false);
        expect(planPartialDelivery(o, 20, 10)).toEqual({ ok: false, error: 'Só há 10 em stock.' });
        expect(planPartialDelivery(o, 40, 50)).toEqual({ ok: false, error: 'Para levar tudo o que falta (40), use "Entregar".' });
    });

    it('encomendas antigas (sem reservedQuantity) libertam da quantidade toda', () => {
        const p = planPartialDelivery({ quantity: 10 }, 4, 10);
        expect(p.ok && p.reservedQuantity).toBe(6);
        expect(orderToProduce({ quantity: 10, quantityProduced: 3 })).toBe(7);
    });
});
