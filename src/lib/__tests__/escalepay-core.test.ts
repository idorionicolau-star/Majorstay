import { describe, it, expect } from 'vitest';
import { extendFrom, extractEmails, planForMonths, saleIdFor, saleMonths } from '@/lib/escalepay-core';

describe('EscalePay: ler os compradores de um texto colado', () => {
    it('tira os emails, sem repetidos nem os da EscalePay, em minúsculas', () => {
        const text = `Nova venda! Comprador: Ana <Ana.Silva@Gmail.com>
            outro: joao_99@hotmail.com, ana.silva@gmail.com.
            Suporte: suporte@escalepay.co.mz · eu@majorstockx.com`;
        expect(extractEmails(text, ['EU@majorstockx.com'])).toEqual(['ana.silva@gmail.com', 'joao_99@hotmail.com']);
        expect(extractEmails('')).toEqual([]);
    });
});

describe('EscalePay: cada venda conta uma vez', () => {
    const day = new Date('2026-10-08T10:00:00Z');
    it('com referência, usa-a; sem ela, email + dia', () => {
        expect(saleIdFor('Ana@x.com', 'Pedido #123/45', day)).toBe('ref-pedido-123-45');
        expect(saleIdFor(' Ana@X.com ', '', day)).toBe('m-ana@x.com-2026-10-08');
        expect(saleIdFor('ana@x.com', null, new Date('2026-10-09T10:00:00Z'))).toBe('m-ana@x.com-2026-10-09');
    });
    it('meses: 1 a 12', () => {
        expect(saleMonths(undefined)).toBe(1);
        expect(saleMonths('3')).toBe(3);
        expect(saleMonths(40)).toBe(12);
        expect(saleMonths(0)).toBe(1);
    });
});

describe('EscalePay: prolongar a subscrição', () => {
    const now = new Date('2026-10-08T10:00:00Z');
    it('sem subscrição (ou já acabada): a partir de agora', () => {
        expect(extendFrom(now, null, 1).end.toISOString()).toBe('2026-11-08T10:00:00.000Z');
        expect(extendFrom(now, '2026-09-01T00:00:00Z', 1).start).toEqual(now);
    });
    it('ainda activa: a partir do fim actual (não perde dias)', () => {
        const r = extendFrom(now, '2026-10-20T10:00:00.000Z', 1);
        expect(r.start.toISOString()).toBe('2026-10-20T10:00:00.000Z');
        expect(r.end.toISOString()).toBe('2026-11-20T10:00:00.000Z');
    });
    it('plano equivalente', () => {
        expect(planForMonths(1)).toBe('mensal');
        expect(planForMonths(2)).toBeUndefined();
    });
});
