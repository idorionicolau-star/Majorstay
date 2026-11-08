import { describe, it, expect } from 'vitest';
import { computeSmartThresholds } from '../smart-thresholds';

const now = new Date('2026-06-30T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const product = (o: object = {}) => ({ id: 'p1', name: 'Cimento', location: 'Principal', lowStockThreshold: 20, criticalStockThreshold: 8, ...o });
const sale = (n: number, qty: number, o: object = {}) => ({ productName: 'Cimento', location: 'Principal', quantity: qty, date: daysAgo(n), status: 'Pago', ...o });

describe('computeSmartThresholds', () => {
    it('mantém os limites do utilizador quando não há histórico', () => {
        const [r] = computeSmartThresholds({ products: [product()], movements: [], sales: [], now });
        expect(r.mode).toBe('kept');
        expect(r.lowStockThreshold).toBe(20);
        expect(r.criticalStockThreshold).toBe(8);
    });

    it('ignora produtos em modo manual', () => {
        expect(computeSmartThresholds({ products: [product({ thresholdMode: 'manual' })], movements: [], sales: [], now })).toHaveLength(0);
    });

    it('com vendas regulares usa o modo estatístico e crítico < baixo', () => {
        const sales = Array.from({ length: 15 }, (_, i) => sale(i, 10));
        const [r] = computeSmartThresholds({ products: [product()], movements: [], sales, now });
        expect(r.mode).toBe('statistical');
        expect(r.ads).toBeGreaterThan(3);
        expect(r.lowStockThreshold).toBeGreaterThanOrEqual(4);
        expect(r.criticalStockThreshold).toBeLessThan(r.lowStockThreshold);
    });

    it('saída lenta nunca baixa o limite que o utilizador já tinha', () => {
        const sales = [sale(40, 2), sale(70, 2)];
        const [r] = computeSmartThresholds({ products: [product()], movements: [], sales, now });
        expect(r.mode).toBe('slow');
        expect(r.lowStockThreshold).toBeGreaterThanOrEqual(20);
        expect(r.criticalStockThreshold).toBe(8);
    });

    it('proformas (Pendente) não contam como consumo', () => {
        const sales = Array.from({ length: 15 }, (_, i) => sale(i, 10, { status: 'Pendente' }));
        const [r] = computeSmartThresholds({ products: [product()], movements: [], sales, now });
        expect(r.mode).toBe('kept');
    });

    it('um pico isolado não dispara o limite', () => {
        const base = Array.from({ length: 20 }, (_, i) => sale(i, 5));
        const spike = [...base, sale(3, 5000)];
        const a = computeSmartThresholds({ products: [product()], movements: [], sales: base, now })[0];
        const b = computeSmartThresholds({ products: [product()], movements: [], sales: spike, now })[0];
        expect(b.lowStockThreshold).toBeLessThan(a.lowStockThreshold * 6);
    });

    it('saídas por venda no histórico de movimentos não são contadas duas vezes', () => {
        const sales = Array.from({ length: 10 }, (_, i) => sale(i, 10));
        const movs = Array.from({ length: 10 }, (_, i) => ({ type: 'OUT', reason: 'Venda #1', productName: 'Cimento', location: 'Principal', quantity: 10, timestamp: daysAgo(i) }));
        const a = computeSmartThresholds({ products: [product()], movements: [], sales, now })[0];
        const b = computeSmartThresholds({ products: [product()], movements: movs, sales, now })[0];
        expect(b.ads).toBe(a.ads);
    });
});
