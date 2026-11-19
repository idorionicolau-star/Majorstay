import { describe, it, expect } from 'vitest';
import {
    toDate, hhmmMaputo, normalizePlate, vehicleText, stayMatchesVehicle, stayRow, stayForSale,
    staysClosedBetween, openStays, checkInsWithoutPlate, staysTotals, totalsByPayment, maputoDay,
} from '../stay-report';

const base = {
    id: 's1', roomName: 'Quarto 3', clientName: 'Ana', vehiclePlate: 'abc-123 mp', vehicleBrand: 'Toyota', vehicleModel: 'Hilux', vehicleColor: 'Branco',
    checkInAt: '2026-11-18T12:05:00Z', checkOutAt: '2026-11-18T14:20:00Z', contractedHours: 2, extensions: [{ hours: 1 }],
    consumptions: [{ quantity: 2, unitPrice: 100, totalPrice: 200 }, { quantity: 1, unitPrice: 50 }],
    billedHours: 3, totalAmountDue: 1100, totalAmountPaid: 1100, discountAmount: 50, paymentMethod: 'M-Pesa',
    openedByName: 'Rita', closedByName: 'João', status: 'closed', saleId: 'v9',
};

describe('stay-report', () => {
    it('lê datas da Firestore, ISO e { seconds }', () => {
        expect(toDate({ toDate: () => new Date('2026-01-01T00:00:00Z') })?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect(toDate({ seconds: 0 })?.getTime()).toBe(0);
        expect(toDate('lixo')).toBeNull();
        expect(toDate(undefined)).toBeNull();
    });
    it('mostra a hora de Maputo', () => {
        expect(hhmmMaputo(new Date('2026-11-18T12:05:00Z'))).toBe('14:05');
        expect(maputoDay(new Date('2026-11-18T22:30:00Z'))).toBe('2026-11-19');
    });
    it('matrícula com ou sem espaços e traços é a mesma', () => {
        expect(normalizePlate('abc-123 mp')).toBe('ABC123MP');
        expect(vehicleText(base)).toBe('ABC-123 MP · Toyota Hilux · Branco');
        expect(stayMatchesVehicle(base, 'ABC123')).toBe(true);
        expect(stayMatchesVehicle(base, '123 mp')).toBe(true);
        expect(stayMatchesVehicle(base, 'hilux')).toBe(true);
        expect(stayMatchesVehicle(base, 'XYZ')).toBe(false);
        expect(stayMatchesVehicle(base, '')).toBe(false);
    });
    it('separa quarto e bar; o desconto entra no total', () => {
        const r = stayRow(base);
        expect(r.consumptionsAmount).toBe(250);
        expect(r.roomAmount).toBe(900); // 1100 + 50 - 250
        expect(r.contractedHours).toBe(3);
        expect(r.extensionsCount).toBe(1);
        expect(r.checkInBy).toBe('Rita');
        expect(r.open).toBe(false);
    });
    it('encontra a estadia da venda: pelo stayId ou pelo saleId (vendas antigas)', () => {
        expect(stayForSale({ id: 'v9' }, [base])?.id).toBe('s1');
        expect(stayForSale({ id: 'x', stayId: 's1' }, [base])?.id).toBe('s1');
        expect(stayForSale({ id: 'x' }, [base])).toBeUndefined();
    });
    it('filtra fechadas no período, abertas e check-ins sem matrícula', () => {
        const open = { ...base, id: 's2', status: 'open', checkOutAt: undefined, vehiclePlate: '' };
        const start = new Date('2026-11-18T00:00:00Z'), end = new Date('2026-11-18T23:59:59Z');
        expect(staysClosedBetween([base, open], start, end).map((s) => s.id)).toEqual(['s1']);
        expect(openStays([base, open]).map((s) => s.id)).toEqual(['s2']);
        expect(checkInsWithoutPlate([base, open], start, end).map((s) => s.id)).toEqual(['s2']);
        expect(stayRow(open).checkOut).toBeNull();
    });
    it('soma totais e agrupa por forma de pagamento', () => {
        expect(staysTotals([stayRow(base), stayRow(base)])).toEqual({ count: 2, rooms: 1800, bar: 500, discount: 100, total: 2200 });
        expect(totalsByPayment([{ paymentMethod: 'M-Pesa', amount: 100 }, { paymentMethod: 'm-pesa', amount: 50 }, { amount: 30 }, { paymentMethod: 'Dinheiro', amount: 500 }]))
            .toEqual([{ method: 'Dinheiro', amount: 500, count: 1 }, { method: 'M-Pesa', amount: 150, count: 2 }, { method: 'Não indicado', amount: 30, count: 1 }]);
    });
});
