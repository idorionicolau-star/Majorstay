import { describe, it, expect } from 'vitest';
import {
  normalizeDate,
  calculateDurationMinutes,
  calculateBilledHours,
  calculateStayPricing,
  calculateExpectedCheckOut,
  computeStayRealtimeStatus,
  formatStayDuration,
  formatTimeRemaining,
} from '../hospitality-calc';

describe('hospitality-calc', () => {
  describe('normalizeDate', () => {
    it('normalizes Date objects', () => {
      const d = new Date('2026-11-08T10:00:00Z');
      expect(normalizeDate(d).getTime()).toBe(d.getTime());
    });

    it('normalizes ISO date strings', () => {
      const iso = '2026-11-08T12:30:00.000Z';
      expect(normalizeDate(iso).toISOString()).toBe(iso);
    });

    it('normalizes Firestore Timestamp-like objects with toDate()', () => {
      const fakeTs = {
        toDate: () => new Date('2026-11-08T14:00:00Z'),
      };
      expect(normalizeDate(fakeTs).toISOString()).toBe('2026-11-08T14:00:00.000Z');
    });

    it('normalizes Firestore Timestamp-like objects with seconds and nanoseconds', () => {
      const fakeTs = {
        seconds: 1700000000,
        nanoseconds: 500000000,
      };
      expect(normalizeDate(fakeTs).getTime()).toBe(1700000000500);
    });

    it('handles numeric epoch ms', () => {
      const ms = 1731000000000;
      expect(normalizeDate(ms).getTime()).toBe(ms);
    });
  });

  describe('calculateDurationMinutes', () => {
    it('calculates exact difference in minutes', () => {
      const checkIn = new Date('2026-11-08T10:00:00Z');
      const checkOut = new Date('2026-11-08T11:25:00Z');
      expect(calculateDurationMinutes(checkIn, checkOut)).toBe(85);
    });

    it('returns 0 if checkOut is before checkIn', () => {
      const checkIn = new Date('2026-11-08T11:00:00Z');
      const checkOut = new Date('2026-11-08T10:00:00Z');
      expect(calculateDurationMinutes(checkIn, checkOut)).toBe(0);
    });
  });

  describe('calculateBilledHours (Regra Anti-Roubo: Hora começada = Hora paga & Mínimo contratado)', () => {
    const baseIn = new Date('2026-11-08T10:00:00Z');

    it('charges contracted hours when guest leaves earlier', () => {
      // Contratou 2 horas, saiu aos 45 minutos -> Cobra 2 horas
      const checkOut = new Date(baseIn.getTime() + 45 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 2, 2)).toBe(2);
    });

    it('charges contracted 1 hour when guest leaves at 50 minutes', () => {
      const checkOut = new Date(baseIn.getTime() + 50 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 1, 2)).toBe(1);
    });

    it('tolerates small grace period of 2 minutes after 1 hour', () => {
      // 1 hora e 1 minuto com 2 min de tolerância -> Continua a ser 1 hora
      const checkOut = new Date(baseIn.getTime() + 61 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 1, 2)).toBe(1);
    });

    it('bills second hour when guest stays beyond grace period (Regra hora começada)', () => {
      // 1 hora e 3 minutos (63 minutos) -> 2º hora começada -> Cobra 2 horas!
      const checkOut = new Date(baseIn.getTime() + 63 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 1, 2)).toBe(2);
    });

    it('bills third hour when stay exceeds 2 hours and grace period', () => {
      // Contratou 2 horas. Saiu aos 125 minutos (2h 05 min) -> Cobra 3 horas
      const checkOut = new Date(baseIn.getTime() + 125 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 2, 2)).toBe(3);
    });

    it('bills 4 hours for 3h 10min stay with 1h contracted', () => {
      // Contratou 1 hora. Ficou 190 min (3h 10 min) -> Cobra 4 horas
      const checkOut = new Date(baseIn.getTime() + 190 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 1, 2)).toBe(4);
    });
  });

  describe('calculateStayPricing', () => {
    it('calculates total correctly based on hourly rate in Meticais', () => {
      const baseIn = new Date('2026-11-08T14:00:00Z');
      // 2h 10m de permanência (130 min) com tarifa de 400 MT/h
      const checkOut = new Date(baseIn.getTime() + 130 * 60 * 1000);
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: 1,
        ratePerHour: 400,
        graceMinutes: 2,
      });

      expect(pricing.durationMinutes).toBe(130);
      expect(pricing.billedHours).toBe(3);
      expect(pricing.contractedHours).toBe(1);
      expect(pricing.overtimeHours).toBe(2);
      expect(pricing.ratePerHour).toBe(400);
      expect(pricing.totalAmountDue).toBe(1200); // 3h * 400 MT = 1200 MT
      expect(pricing.isOvertime).toBe(true);
    });

    it('handles on-time stay without overtime', () => {
      const baseIn = new Date('2026-11-08T14:00:00Z');
      const checkOut = new Date(baseIn.getTime() + 55 * 60 * 1000);
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: 1,
        ratePerHour: 350,
      });

      expect(pricing.billedHours).toBe(1);
      expect(pricing.overtimeHours).toBe(0);
      expect(pricing.totalAmountDue).toBe(350);
      expect(pricing.isOvertime).toBe(false);
    });

    it('integrates bar consumptions into total amount due', () => {
      const baseIn = new Date('2026-11-08T14:00:00Z');
      const checkOut = new Date(baseIn.getTime() + 60 * 60 * 1000); // 1h
      const consumptions = [
        { id: 'c1', productName: 'Cerveja 2M', quantity: 2, unitPrice: 80, totalPrice: 160, addedAt: baseIn, addedBy: 'u1' },
        { id: 'c2', productName: 'Água Namaacha', quantity: 1, unitPrice: 40, totalPrice: 40, addedAt: baseIn, addedBy: 'u1' },
      ];
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: 1,
        ratePerHour: 300,
        consumptions,
      });

      expect(pricing.stayAmountDue).toBe(300);
      expect(pricing.consumptionsAmountDue).toBe(200);
      expect(pricing.totalAmountDue).toBe(500);
    });
  });

  describe('calculateExpectedCheckOut & extensions', () => {
    it('calculates expected departure time based on check-in and contracted hours', () => {
      const checkIn = new Date('2026-11-08T10:00:00Z');
      const expected = calculateExpectedCheckOut(checkIn, 2);
      expect(expected.toISOString()).toBe('2026-11-08T12:00:00.000Z');
    });

    it('adds extensions to expected checkout', () => {
      const checkIn = new Date('2026-11-08T10:00:00Z');
      const extensions = [
        { hours: 1, addedAt: '2026-11-08T11:30:00Z', addedBy: 'user-1' },
        { hours: 2, addedAt: '2026-11-08T12:30:00Z', addedBy: 'user-1' },
      ];
      // 2h inicial + 1h + 2h = 5h total
      const expected = calculateExpectedCheckOut(checkIn, 2, extensions);
      expect(expected.toISOString()).toBe('2026-11-08T15:00:00.000Z');
    });
  });

  describe('computeStayRealtimeStatus', () => {
    it('reports remaining time when stay is within contracted schedule', () => {
      const checkIn = new Date('2026-11-08T10:00:00Z');
      const now = new Date('2026-11-08T10:40:00Z'); // 40 min in, 20 min left of 1h
      const status = computeStayRealtimeStatus({
        status: 'open',
        checkInAt: checkIn,
        contractedHours: 1,
        now,
      });

      expect(status.isOvertime).toBe(false);
      expect(status.minutesRemainingOrOverdue).toBe(20);
      expect(status.durationMinutes).toBe(40);
    });

    it('reports overtime when current time exceeds expected check-out', () => {
      const checkIn = new Date('2026-11-08T10:00:00Z');
      const now = new Date('2026-11-08T11:15:00Z'); // 15 min overdue
      const status = computeStayRealtimeStatus({
        status: 'open',
        checkInAt: checkIn,
        contractedHours: 1,
        now,
      });

      expect(status.isOvertime).toBe(true);
      expect(status.minutesRemainingOrOverdue).toBe(-15);
      expect(status.durationMinutes).toBe(75);
    });

    it('returns isOvertime false for closed stays', () => {
      const checkIn = new Date('2026-11-08T10:00:00Z');
      const now = new Date('2026-11-08T14:00:00Z');
      const status = computeStayRealtimeStatus({
        status: 'closed',
        checkInAt: checkIn,
        contractedHours: 1,
        now,
      });

      expect(status.isOvertime).toBe(false);
      expect(status.minutesRemainingOrOverdue).toBe(0);
    });
  });

  describe('formatting helpers', () => {
    it('formats duration in minutes', () => {
      expect(formatStayDuration(45)).toBe('45 min');
      expect(formatStayDuration(60)).toBe('1h');
      expect(formatStayDuration(85)).toBe('1h 25 min');
      expect(formatStayDuration(120)).toBe('2h');
    });

    it('formats remaining or overdue time', () => {
      expect(formatTimeRemaining(45)).toBe('Restam 45 min');
      expect(formatTimeRemaining(75)).toBe('Restam 1h 15 min');
      expect(formatTimeRemaining(0)).toBe('Tempo terminado agora');
      expect(formatTimeRemaining(-20)).toBe('Excedido há 20 min');
      expect(formatTimeRemaining(-80)).toBe('Excedido há 1h 20 min');
    });
  });
});
