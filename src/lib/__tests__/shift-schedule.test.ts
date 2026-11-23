import { describe, it, expect } from 'vitest';
import { sanitizeSchedule, slotAt, slotContains, slotEnd } from '../shift-schedule';

// Maputo = UTC+2: 07:00 Maputo = 05:00Z
const at = (h: number, m = 0, day = 23) => new Date(Date.UTC(2026, 10, day, h - 2, m));

describe('sanitizeSchedule', () => {
    it('só fica com turnos válidos, nomes aparados, no máximo 6', () => {
        const raw = [
            { name: '  Manhã ', start: '07:00', end: '17:00' },
            { name: '', start: '07:00', end: '17:00' },
            { name: 'X', start: '7:00', end: '17:00' },
            { name: 'Y', start: '07:00', end: '25:00' },
            ...Array.from({ length: 10 }, (_, i) => ({ name: `T${i}`, start: '08:00', end: '09:00' })),
        ];
        const out = sanitizeSchedule(raw);
        expect(out[0]).toEqual({ name: 'Manhã', start: '07:00', end: '17:00' });
        expect(out).toHaveLength(6);
        expect(sanitizeSchedule('lixo')).toEqual([]);
    });
});

describe('slotContains / slotAt', () => {
    const day = { name: 'Dia', start: '07:00', end: '17:00' };
    const night = { name: 'Noite', start: '17:00', end: '07:00' };
    it('turno normal e turno que passa a meia-noite', () => {
        expect(slotContains(day, 7 * 60)).toBe(true);
        expect(slotContains(day, 17 * 60)).toBe(false);
        expect(slotContains(night, 23 * 60)).toBe(true);
        expect(slotContains(night, 3 * 60)).toBe(true);
        expect(slotContains(night, 12 * 60)).toBe(false);
    });
    it('07:00–07:00 cobre o dia todo', () => {
        expect(slotContains({ name: '24h', start: '07:00', end: '07:00' }, 3 * 60)).toBe(true);
    });
    it('escolhe o turno da hora (em Maputo)', () => {
        expect(slotAt([day, night], at(10))?.name).toBe('Dia');
        expect(slotAt([day, night], at(2))?.name).toBe('Noite');
        expect(slotAt([day], at(20))).toBeNull();
    });
});

describe('slotEnd', () => {
    it('o fim do turno do dia é às 17:00 do mesmo dia', () => {
        expect(slotEnd({ name: 'Dia', start: '07:00', end: '17:00' }, at(7, 12)).toISOString()).toBe(at(17).toISOString());
    });
    it('turno da noite aberto às 19:00 acaba às 07:00 do dia seguinte; aberto à 01:00 acaba às 07:00 do mesmo dia', () => {
        const night = { name: 'Noite', start: '19:00', end: '07:00' };
        expect(slotEnd(night, at(19, 5, 23)).toISOString()).toBe(at(7, 0, 24).toISOString());
        expect(slotEnd(night, at(1, 0, 24)).toISOString()).toBe(at(7, 0, 24).toISOString());
    });
    it('07:00–07:00 aberto às 07:00 acaba 24 horas depois', () => {
        expect(slotEnd({ name: '24h', start: '07:00', end: '07:00' }, at(7, 0)).toISOString()).toBe(at(7, 0, 24).toISOString());
    });
});
