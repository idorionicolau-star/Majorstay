import { describe, it, expect } from 'vitest';
import { planCheckIn, subscriptionBlocked } from '@/lib/stay-checkin';
import { diffRoomConfig, sanitizeRoomConfig, isConfigKey } from '@/lib/room-config';

const NOW = new Date('2026-11-25T10:00:00Z'); // 12:00 em Maputo

describe('planCheckIn: o preço vem do quarto, nunca do ecrã', () => {
  const room = { ratePerHour: 1000, minimumHours: 2, overnightPrice: 2500, overnightEndHour: 10, dailyPrice: 4000 };

  it('1000 a cada 2 horas: pedir 2h custa 1000', () => {
    const p = planCheckIn(room, { contractedHours: 2 }, NOW) as any;
    expect(p.contractedHours).toBe(2);
    expect(p.blockHours).toBe(2);
    expect(p.ratePerHourApplied).toBe(500);
    expect(p.totalAmountDue).toBe(1000);
  });

  it('pedir 1h arredonda ao bloco: 2h = 1000', () => {
    const p = planCheckIn(room, { contractedHours: 1 }, NOW) as any;
    expect(p.contractedHours).toBe(2);
    expect(p.totalAmountDue).toBe(1000);
  });

  it('pedir 3h arredonda a 4h = 2000', () => {
    const p = planCheckIn(room, { contractedHours: 3 }, NOW) as any;
    expect(p.contractedHours).toBe(4);
    expect(p.totalAmountDue).toBe(2000);
  });

  it('quarto sem mínimo (1h): 1000 por hora', () => {
    const p = planCheckIn({ ratePerHour: 1000, minimumHours: 1 }, { contractedHours: 2 }, NOW) as any;
    expect(p.ratePerHourApplied).toBe(1000);
    expect(p.totalAmountDue).toBe(2000);
  });

  it('pernoite: preço fixo do quarto e horas até à hora de saída', () => {
    const p = planCheckIn(room, { packageType: 'pernoite', contractedHours: 99 }, NOW) as any;
    expect(p.packageType).toBe('pernoite');
    expect(p.packagePrice).toBe(2500);
    expect(p.contractedHours).toBe(22); // 12:00 → 10:00 do dia seguinte
    expect(p.totalAmountDue).toBe(2500);
  });

  it('diária: 24h ao preço do quarto', () => {
    const p = planCheckIn(room, { packageType: 'diaria' }, NOW) as any;
    expect(p.contractedHours).toBe(24);
    expect(p.totalAmountDue).toBe(4000);
  });

  it('pacote que o quarto não tem é recusado', () => {
    expect(planCheckIn({ ratePerHour: 1000 }, { packageType: 'diaria' }, NOW)).toHaveProperty('error');
  });

  it('horas inválidas são recusadas', () => {
    for (const h of [0, -1, 'abc', undefined, 100000]) {
      expect(planCheckIn(room, { contractedHours: h }, NOW)).toHaveProperty('error');
    }
  });
});

describe('subscriptionBlocked', () => {
  const now = Date.parse('2026-11-25T10:00:00Z');
  it('suspensa ou inativa bloqueia', () => {
    expect(subscriptionBlocked({ status: 'suspended' }, now)).toBe(true);
    expect(subscriptionBlocked({ status: 'inactive' }, now)).toBe(true);
  });
  it('ativa sem data, ou com pagamento em dia, passa', () => {
    expect(subscriptionBlocked({ status: 'active' }, now)).toBe(false);
    expect(subscriptionBlocked({}, now)).toBe(false);
    expect(subscriptionBlocked({ status: 'active', paidUntilMs: now + 1000 }, now)).toBe(false);
  });
  it('pagamento vencido bloqueia; teste acabado bloqueia, teste a decorrer passa', () => {
    expect(subscriptionBlocked({ status: 'active', paidUntilMs: now - 1000 }, now)).toBe(true);
    expect(subscriptionBlocked({ status: 'trial', trialEndsAt: '2026-11-24T00:00:00.000Z' }, now)).toBe(true);
    expect(subscriptionBlocked({ status: 'trial', trialEndsAt: '2026-12-24T00:00:00.000Z' }, now)).toBe(false);
  });
});

describe('room-config', () => {
  it('só os campos do administrador contam como configuração', () => {
    for (const k of ['ratePerHour', 'minimumHours', 'overnightPrice', 'dailyPrice', 'name', 'images']) expect(isConfigKey(k)).toBe(true);
    for (const k of ['status', 'currentStayId', 'cleaningStartedAt']) expect(isConfigKey(k)).toBe(false);
  });

  it('valida números e ignora campos desconhecidos', () => {
    expect(sanitizeRoomConfig({ ratePerHour: 1000, minimumHours: 2, hack: 'x', status: 'free' })).toEqual({ ratePerHour: 1000, minimumHours: 2 });
    expect(() => sanitizeRoomConfig({ ratePerHour: -5 })).toThrow();
    expect(() => sanitizeRoomConfig({ ratePerHour: 'abc' })).toThrow();
    expect(() => sanitizeRoomConfig({ name: '   ' })).toThrow();
    expect(sanitizeRoomConfig({ minimumHours: 0 }).minimumHours).toBe(1);
    expect(sanitizeRoomConfig({ images: ['a', 5, '', 'b'] }).images).toEqual(['a', 'b']);
  });

  it('o registo guarda só o que mudou', () => {
    const d = diffRoomConfig({ name: 'Q8', ratePerHour: 1000, minimumHours: 2 }, { name: 'Q8', ratePerHour: 1000, minimumHours: 1 });
    expect(d).toEqual({ before: { minimumHours: 2 }, after: { minimumHours: 1 } });
    expect(diffRoomConfig({ ratePerHour: 1000 }, { ratePerHour: 1000 })).toBeNull();
  });
});
