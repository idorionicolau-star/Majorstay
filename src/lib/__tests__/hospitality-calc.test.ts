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
  totalContractedHours,
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

    it('tolerates compensation period of 10 minutes after 1 hour', () => {
      // 1 hora e 9 minutos com 10 min de compensação -> Continua a ser 1 hora
      const checkOut = new Date(baseIn.getTime() + 69 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 1)).toBe(1);

      // Exatamente 1 hora e 10 minutos (70 min) -> Ainda dentro da compensação de 10 min -> 1 hora
      const checkOutExact = new Date(baseIn.getTime() + 70 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOutExact, 1)).toBe(1);
    });

    it('bills second hour when guest stays beyond 10 minutes compensation', () => {
      // 1 hora e 11 minutos (71 minutos) -> 2º hora começada -> Cobra 2 horas!
      const checkOut = new Date(baseIn.getTime() + 71 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 1)).toBe(2);
    });

    it('bills third hour when stay exceeds 2 hours and 10 minutes compensation', () => {
      // Contratou 2 horas. Saiu aos 130 minutos (2h 10 min) -> Ainda 2 horas
      const checkOutGrace = new Date(baseIn.getTime() + 130 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOutGrace, 2)).toBe(2);

      // Saiu aos 131 minutos (2h 11 min) -> 3ª hora começada -> Cobra 3 horas
      const checkOut = new Date(baseIn.getTime() + 131 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 2)).toBe(3);
    });

    it('bills 4 hours for 3h 11min stay with 1h contracted', () => {
      // Contratou 1 hora. Ficou 191 min (3h 11 min) -> Cobra 4 horas
      const checkOut = new Date(baseIn.getTime() + 191 * 60 * 1000);
      expect(calculateBilledHours(baseIn, checkOut, 1)).toBe(4);
    });
  });

  describe('calculateStayPricing', () => {
    it('calculates total correctly based on hourly rate in Meticais', () => {
      const baseIn = new Date('2026-11-08T14:00:00Z');
      // 2h 15m de permanência (135 min) com tarifa de 400 MT/h
      const checkOut = new Date(baseIn.getTime() + 135 * 60 * 1000);
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: 1,
        ratePerHour: 400,
      });

      expect(pricing.durationMinutes).toBe(135);
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
      expect(formatTimeRemaining(0)).toBe('Compensação: restam 10 min');
      expect(formatTimeRemaining(-4)).toBe('Compensação: restam 6 min');
      expect(formatTimeRemaining(-20)).toBe('Excedido há 20 min');
      expect(formatTimeRemaining(-80)).toBe('Excedido há 1h 20 min');
    });
  });

  describe('totalContractedHours & Prorrogações (Opção A)', () => {
    const baseIn = new Date('2026-11-10T12:00:00Z');

    it('calcula totalContractedHours como contractedHours + soma das horas de extensions', () => {
      expect(totalContractedHours({ contractedHours: 1, extensions: [{ hours: 1, addedAt: baseIn, addedBy: 'u1' }] })).toBe(2);
      expect(totalContractedHours({ contractedHours: 2, extensions: [{ hours: 1, addedAt: baseIn, addedBy: 'u1' }, { hours: 2, addedAt: baseIn, addedBy: 'u1' }] })).toBe(5);
      expect(totalContractedHours({ contractedHours: 1 })).toBe(1);
      expect(totalContractedHours(null)).toBe(1);
    });

    it('1h contratada + 1h prorrogada, 300 MT/h, tolerância 10 min: saída aos 65 min cobra 2h (600)', () => {
      const stay = {
        contractedHours: 1,
        extensions: [{ hours: 1, addedAt: baseIn, addedBy: 'u1' }],
      };
      const checkOut = new Date(baseIn.getTime() + 65 * 60 * 1000);
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: totalContractedHours(stay),
        ratePerHour: 300,
        graceMinutes: 10,
      });

      expect(pricing.billedHours).toBe(2);
      expect(pricing.totalAmountDue).toBe(600);
      expect(pricing.overtimeHours).toBe(0);
    });

    it('1h contratada + 1h prorrogada, 300 MT/h, tolerância 10 min: saída aos 125 min cobra 2h (600)', () => {
      const stay = {
        contractedHours: 1,
        extensions: [{ hours: 1, addedAt: baseIn, addedBy: 'u1' }],
      };
      const checkOut = new Date(baseIn.getTime() + 125 * 60 * 1000);
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: totalContractedHours(stay),
        ratePerHour: 300,
        graceMinutes: 10,
      });

      expect(pricing.billedHours).toBe(2);
      expect(pricing.totalAmountDue).toBe(600);
      expect(pricing.overtimeHours).toBe(0);
    });

    it('1h contratada + 1h prorrogada, 300 MT/h, tolerância 10 min: saída aos 140 min cobra 3h (900)', () => {
      const stay = {
        contractedHours: 1,
        extensions: [{ hours: 1, addedAt: baseIn, addedBy: 'u1' }],
      };
      // 140 min ultrapassa 120 + 10 min de tolerância -> 3ª hora começada
      const checkOut = new Date(baseIn.getTime() + 140 * 60 * 1000);
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: totalContractedHours(stay),
        ratePerHour: 300,
        graceMinutes: 10,
      });

      expect(pricing.billedHours).toBe(3);
      expect(pricing.totalAmountDue).toBe(900);
      expect(pricing.overtimeHours).toBe(1);
    });

    it('sem prorrogação, o comportamento atual mantém-se (1h contratada, 300 MT/h: saída aos 65 min cobra 1h devido aos 10 min de tolerância)', () => {
      const stay = {
        contractedHours: 1,
        extensions: [],
      };
      const checkOut = new Date(baseIn.getTime() + 65 * 60 * 1000);
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: checkOut,
        contractedHours: totalContractedHours(stay),
        ratePerHour: 300,
        graceMinutes: 10,
      });

      expect(pricing.billedHours).toBe(1);
      expect(pricing.totalAmountDue).toBe(300);
      expect(pricing.overtimeHours).toBe(0);
    });
  });
});
