import { describe, it, expect } from 'vitest';
import { stayRow } from '../stay-report';
import { noPlateHtml, parkedHtml, paymentsHtml, staysHtml } from '../stay-report-email';

const stay = {
    id: 's1', roomName: 'Quarto <3>', clientName: 'Ana', clientPhone: '841234567', clientDoc: '110100000000A',
    vehiclePlate: 'ABC 123 MP', vehicleBrand: 'Toyota', vehicleColor: 'Branco',
    checkInAt: '2026-11-18T12:05:00Z', checkOutAt: '2026-11-18T14:20:00Z', contractedHours: 2, billedHours: 3,
    consumptions: [{ quantity: 1, unitPrice: 200, totalPrice: 200 }], totalAmountDue: 1100, paymentMethod: 'M-Pesa',
    openedByName: 'Rita', closedByName: 'João', status: 'closed',
};

describe('email das estadias', () => {
    it('mostra viatura, horas, valores e quem atendeu, sem telefone nem BI', () => {
        const html = staysHtml([stayRow(stay)]);
        expect(html).toContain('ABC 123 MP · Toyota · Branco');
        expect(html).toContain('14:05 → 16:20');
        expect(html).toContain('check-in: Rita');
        expect(html).toContain('Quarto &lt;3&gt;');
        expect(html).not.toContain('841234567');
        expect(html).not.toContain('110100000000A');
    });
    it('secções vazias não aparecem', () => {
        expect(staysHtml([])).toBe('');
        expect(parkedHtml([])).toBe('');
        expect(noPlateHtml([])).toBe('');
        expect(paymentsHtml([])).toBe('');
    });
    it('viaturas no parque e aviso sem matrícula', () => {
        expect(parkedHtml([stayRow({ ...stay, status: 'open' })])).toContain('Viaturas no parque agora (1)');
        expect(noPlateHtml(['Quarto 2', 'Quarto 5'])).toContain('2 check-ins sem matrícula');
    });
});
