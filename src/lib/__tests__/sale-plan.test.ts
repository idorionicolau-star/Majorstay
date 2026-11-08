import { describe, it, expect } from 'vitest';
import { planBulkSale, planSingleSale, planPickup, nextGuideNumber, provisionalGuideNumber, isProvisionalNumber, type PlanSource } from '../sale-plan';

const src = (id: string, o: Partial<PlanSource['data']> = {}): PlanSource => ({ id, data: { name: 'Cimento', stock: 100, reservedStock: 0, location: 'Principal', price: 500, cost: 400, ...o } });
const item = (o: object = {}) => ({ productId: 'a', productName: 'Cimento', quantity: 10, unitPrice: 500, subtotal: 5000, ...o });
const base = { applyVat: false, vatPercentage: 16, documentType: 'Venda a Dinheiro' as const };
const user = { id: 'u1', username: 'ana', role: 'Vendedor' };
let n = 0;
const common = { isMultiLocation: false, defaultLocation: 'Principal', user, guideNumber: 'GT-000001', nowIso: '2026-06-30T10:00:00Z', newId: () => `s${++n}` };

describe('planBulkSale', () => {
    it('levantado no acto: tira do stock, regista movimento, nada reservado', () => {
        const p = planBulkSale({ ...common, items: [item()], saleData: base, sources: [src('a')] });
        expect(p.deltas).toEqual([{ id: 'a', stock: -10, reserved: 0 }]);
        expect(p.movements).toHaveLength(1);
        expect(p.sales[0].status).toBe('Levantado');
        expect(p.sales[0].amountPaid).toBe(5000);
    });

    it('por levantar: reserva em vez de tirar', () => {
        const p = planBulkSale({ ...common, items: [item()], saleData: { ...base, isPickedUp: false }, sources: [src('a')] });
        expect(p.deltas).toEqual([{ id: 'a', stock: 0, reserved: 10 }]);
        expect(p.movements).toHaveLength(0);
        expect(p.sales[0].status).toBe('Pago');
    });

    it('proforma não mexe no stock e fica Pendente', () => {
        const p = planBulkSale({ ...common, items: [item({ quantity: 9999, subtotal: 1 })], saleData: { ...base, documentType: 'Factura Proforma' }, sources: [src('a')] });
        expect(p.deltas).toEqual([]);
        expect(p.sales[0].status).toBe('Pendente');
        expect(p.sales[0].amountPaid).toBe(0);
    });

    it('recusa vender mais do que o disponível (stock - reservado)', () => {
        expect(() => planBulkSale({ ...common, items: [item({ quantity: 60 })], saleData: base, sources: [src('a', { stock: 100, reservedStock: 50 })] }))
            .toThrow(/Stock insuficiente.*Disponível: 50/);
    });

    it('reparte por vários registos do mesmo produto', () => {
        const p = planBulkSale({ ...common, items: [item({ quantity: 15 })], saleData: base, sources: [src('a', { stock: 10 }), src('b', { stock: 10 })] });
        expect(p.deltas).toEqual([{ id: 'a', stock: -10, reserved: 0 }, { id: 'b', stock: -5, reserved: 0 }]);
    });

    it('duas linhas do mesmo produto no carrinho não vendem o mesmo stock duas vezes', () => {
        expect(() => planBulkSale({ ...common, items: [item({ quantity: 60 }), item({ quantity: 60 })], saleData: base, sources: [src('a')] })).toThrow(/Stock insuficiente/);
    });

    it('desconto e IVA repartidos proporcionalmente; pagamento parcial', () => {
        const p = planBulkSale({
            ...common,
            items: [item({ subtotal: 1000, quantity: 1 }), item({ productName: 'Areia', subtotal: 3000, quantity: 1 })],
            saleData: { ...base, discount: { type: 'percentage', value: 10 }, applyVat: true, vatPercentage: 16, amountPaid: 2000 },
            sources: [src('a'), src('b', { name: 'Areia' })],
        });
        const total = p.sales.reduce((t, s) => t + s.totalValue, 0);
        expect(total).toBeCloseTo(4000 * 0.9 * 1.16, 5);
        expect(p.sales[1].discount).toBeCloseTo(300, 5);
        const paid = p.sales.reduce((t, s) => t + (s.amountPaid || 0), 0);
        expect(paid).toBeCloseTo(2000, 1);
    });

    it('preço diferente do habitual pede confirmação — mas não ao gestor', () => {
        const seller = planBulkSale({ ...common, items: [item({ unitPrice: 450, subtotal: 4500 })], saleData: base, sources: [src('a')] });
        expect(seller.priceReviews).toHaveLength(1);
        const boss = planBulkSale({ ...common, user: { ...user, role: 'Dono' }, items: [item({ unitPrice: 450, subtotal: 4500 })], saleData: base, sources: [src('a')] });
        expect(boss.priceReviews).toHaveLength(0);
    });

    it('produto sem preço aprende o preço da venda', () => {
        const p = planBulkSale({ ...common, items: [item()], saleData: base, sources: [src('a', { price: 0 })] });
        expect(p.deltas[0].price).toBe(500);
    });
});

describe('planSingleSale', () => {
    const input = { date: '2026-06-30', productId: 'a', productName: 'Cimento', quantity: 5, unitPrice: 500, subtotal: 2500, totalValue: 2500, soldBy: 'ana', status: 'Levantado' as const, documentType: 'Venda a Dinheiro' as const };
    it('levantado tira do stock; pago reserva', () => {
        const a = planSingleSale({ sale: input, reserveStock: true, source: src('a'), user, guideNumber: 'X', nowIso: 'n', newId: () => 'id' });
        expect(a.deltas).toEqual([{ id: 'a', stock: -5, reserved: 0 }]);
        expect(a.sale.unitCost).toBe(400);
        const b = planSingleSale({ sale: { ...input, status: 'Pago' }, reserveStock: true, source: src('a'), user, guideNumber: 'X', nowIso: 'n', newId: () => 'id' });
        expect(b.deltas).toEqual([{ id: 'a', stock: 0, reserved: 5 }]);
    });
    it('erros: produto em falta e stock insuficiente', () => {
        expect(() => planSingleSale({ sale: input, reserveStock: true, source: null, user, guideNumber: 'X', nowIso: 'n', newId: () => 'id' })).toThrow(/não encontrado/);
        expect(() => planSingleSale({ sale: { ...input, quantity: 500 }, reserveStock: true, source: src('a'), user, guideNumber: 'X', nowIso: 'n', newId: () => 'id' })).toThrow(/insuficiente/);
    });
});

describe('planPickup', () => {
    it('liberta a reserva e tira o stock', () => {
        const r = planPickup({ quantity: 10, sources: [src('a', { stock: 50, reservedStock: 10 })] });
        if ('error' in r) throw new Error('inesperado');
        expect(r.deltas).toEqual([{ id: 'a', stock: -10, reserved: -10 }]);
        expect(r.remainingStock).toBe(40);
    });
    it('sem stock suficiente devolve erro com o total', () => {
        const r = planPickup({ quantity: 10, sources: [src('a', { stock: 4 })] });
        expect(r).toEqual({ error: 4 });
    });
});

describe('numeração', () => {
    it('usa o prefixo configurado, com preenchimento', () => {
        const r = nextGuideNumber({ saleCounter: 7, documentNumbering: { Factura: { prefix: 'FT', separator: '/', padding: 4, nextNumber: 12 } } }, 'Factura');
        expect(r.guideNumber).toBe('FT/0012');
        expect(r.numberingUpdate).toEqual({ 'documentNumbering.Factura.nextNumber': 13 });
    });
    it('sem configuração usa GT-000000', () => {
        expect(nextGuideNumber({ saleCounter: 41 }, 'Recibo').guideNumber).toBe('GT-000042');
    });
    it('número provisório é reconhecível e quase nunca repete', () => {
        const a = provisionalGuideNumber(1_800_000_000_000, () => 0.1);
        expect(isProvisionalNumber(a)).toBe(true);
        expect(isProvisionalNumber('GT-000001')).toBe(false);
        expect(provisionalGuideNumber(1_800_000_000_000, () => 0.2)).not.toBe(a);
    });
});
