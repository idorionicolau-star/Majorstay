import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatSaleMoment, saleMoment, toDate, withSaleTime } from '../sale-time';

const OLD = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Africa/Maputo'; }); // UTC+2, como os utilizadores
afterAll(() => { if (OLD === undefined) delete process.env.TZ; else process.env.TZ = OLD; });

describe('data e hora da venda (Maputo, UTC+2)', () => {
    it('venda registada agora: dia e hora locais', () => {
        expect(saleMoment({ date: '2026-10-03T12:32:10.000Z' })).toEqual({ day: '03/10/2026', time: '14:32' });
    });
    it('o dia local pode ser diferente do dia UTC (venda à 01:15 local)', () => {
        expect(saleMoment({ date: '2026-10-02T23:15:00.000Z' })).toEqual({ day: '03/10/2026', time: '01:15' });
    });
    it('data só com o dia: não inventa hora', () => {
        expect(saleMoment({ date: '2026-10-01' })).toEqual({ day: '01/10/2026', time: null });
        expect(saleMoment({ date: '2026-10-01T00:00:00.000Z' })).toEqual({ day: '01/10/2026', time: null });
    });
    it('data escolhida à mão (meia-noite local) fica só com o dia escolhido', () => {
        expect(saleMoment({ date: '2026-09-30T22:00:00.000Z' })).toEqual({ day: '01/10/2026', time: null });
    });
    it('sem hora na data mas registada nesse dia: usa a hora do registo', () => {
        const ts = { toDate: () => new Date('2026-10-01T08:05:00.000Z') }; // 10:05 locais
        expect(saleMoment({ date: '2026-10-01', timestamp: ts })).toEqual({ day: '01/10/2026', time: '10:05' });
        expect(saleMoment({ date: '2026-09-30T22:00:00.000Z', timestamp: { seconds: Date.parse('2026-10-01T08:05:00.000Z') / 1000 } })).toEqual({ day: '01/10/2026', time: '10:05' });
    });
    it('venda com data de outro dia não leva a hora do registo (era misturar)', () => {
        const ts = { toDate: () => new Date('2026-10-05T08:05:00.000Z') };
        expect(saleMoment({ date: '2026-10-01', timestamp: ts })).toEqual({ day: '01/10/2026', time: null });
    });
    it('formato de texto e datas inválidas', () => {
        expect(formatSaleMoment({ date: '2026-10-03T12:32:10.000Z' })).toBe('03/10/2026 às 14:32');
        expect(formatSaleMoment({ date: '2026-10-01' })).toBe('01/10/2026');
        expect(saleMoment({ date: 'lixo' })).toEqual({ day: '', time: null });
        expect(saleMoment({})).toEqual({ day: '', time: null });
        expect(toDate(null)).toBeNull();
    });
});

describe('corrigir o dia de uma venda (Maputo, UTC+2)', () => {
    it('outro dia mantém a hora da venda', () => {
        expect(withSaleTime(new Date(2026, 9, 14), '2026-10-17T10:06:00.000Z')).toBe('2026-10-14T10:06:00.000Z');
    });
    it('o mesmo dia fica exactamente como estava', () => {
        expect(withSaleTime(new Date(2026, 9, 17), '2026-10-17T10:06:00.000Z')).toBe('2026-10-17T10:06:00.000Z');
        expect(withSaleTime(new Date('2026-10-01'), '2026-10-01')).toBe('2026-10-01');
    });
    it('venda sem hora: o novo dia fica sem hora (meia-noite local)', () => {
        expect(saleMoment({ date: withSaleTime(new Date(2026, 9, 5), '2026-10-01') })).toEqual({ day: '05/10/2026', time: null });
    });
});
