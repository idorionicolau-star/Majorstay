import { describe, it, expect } from 'vitest';
import { calculateStayPricing, contractedStayAmount, stayChargeForHours } from '../hospitality-calc';

const RATE = 300;
const PKG = { ratePerHourApplied: RATE, packagePrice: 1500, packageHours: 12 };
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000);

describe('preços fixos (pernoite / diária)', () => {
  it('sem pacote cobra horas × preço da hora', () => {
    expect(stayChargeForHours({ ratePerHourApplied: RATE }, 3)).toBe(900);
  });

  it('pernoite cobra o preço fixo (diferente de 12 × hora)', () => {
    expect(stayChargeForHours(PKG, 12)).toBe(1500);
    expect(12 * RATE).not.toBe(1500);
  });

  it('horas a mais depois do pacote pagam o preço da hora', () => {
    expect(stayChargeForHours(PKG, 14)).toBe(1500 + 2 * RATE);
  });

  it('saída antes do fim do pacote não baixa o preço', () => {
    expect(stayChargeForHours(PKG, 5)).toBe(1500);
  });

  it('prorrogação sobre pernoite soma horas ao preço da hora', () => {
    const stay = { ...PKG, contractedHours: 12, extensions: [{ hours: 2, addedAt: new Date(), addedBy: '' }] };
    expect(contractedStayAmount(stay)).toBe(1500 + 2 * RATE);
  });

  it('check-out dentro do pacote cobra só o preço fixo', () => {
    const p = calculateStayPricing({ checkInAt: at(12 * 60), contractedHours: 12, ratePerHour: RATE, packagePrice: 1500, packageHours: 12 });
    expect(p.stayAmountDue).toBe(1500);
    expect(p.isOvertime).toBe(false);
  });

  it('check-out depois do pacote cobra o excesso à hora', () => {
    const p = calculateStayPricing({ checkInAt: at(13 * 60 + 5), contractedHours: 12, ratePerHour: RATE, packagePrice: 1500, packageHours: 12 });
    expect(p.billedHours).toBe(13);
    expect(p.stayAmountDue).toBe(1500 + RATE);
  });

  it('estadia por hora continua igual a antes', () => {
    const p = calculateStayPricing({ checkInAt: at(60), contractedHours: 2, ratePerHour: RATE });
    expect(p.stayAmountDue).toBe(2 * RATE);
  });
});
