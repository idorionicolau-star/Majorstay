import { describe, it, expect } from 'vitest';
import { calculateStayPricing } from '../hospitality-calc';

const t0 = new Date('2026-11-14T10:00:00Z');
const at = (min: number) => new Date(t0.getTime() + min * 60000);
// taxa 1100 a cada 2h => 550/h aplicada, bloco 2
const base = { checkInAt: t0, contractedHours: 2, ratePerHour: 550, blockHours: 2 };

describe('taxa por bloco (1100 a cada 2h)', () => {
  it('2h = 1100', () => expect(calculateStayPricing({ ...base, checkOutAt: at(115) }).stayAmountDue).toBe(1100));
  it('2h05 (tolerância) = 1100', () => expect(calculateStayPricing({ ...base, checkOutAt: at(125) }).stayAmountDue).toBe(1100));
  it('2h30 = 2200 (novo bloco inteiro)', () => expect(calculateStayPricing({ ...base, checkOutAt: at(150) }).stayAmountDue).toBe(2200));
  it('4h = 2200', () => expect(calculateStayPricing({ ...base, contractedHours: 4, checkOutAt: at(230) }).stayAmountDue).toBe(2200));
  it('bloco de 3h com 1100: sem erros de arredondamento', () =>
    expect(calculateStayPricing({ checkInAt: t0, checkOutAt: at(170), contractedHours: 3, ratePerHour: 1100 / 3, blockHours: 3 }).stayAmountDue).toBe(1100));
  it('sem bloco continua por hora', () =>
    expect(calculateStayPricing({ checkInAt: t0, checkOutAt: at(130), contractedHours: 1, ratePerHour: 300 }).stayAmountDue).toBe(600));
});
