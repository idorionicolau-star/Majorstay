import { describe, it, expect } from 'vitest';
import { buildQuote, priceChanged, stayPricingAt } from '@/lib/checkout-pricing';

const IN = new Date('2026-11-24T17:41:00Z'); // 19:41 em Maputo
const stay = { checkInAt: IN.toISOString(), contractedHours: 2, ratePerHourApplied: 1000, consumptions: [] as any[] };
const at = (min: number) => new Date(IN.getTime() + min * 60_000);

describe('cotação do check-out (hora do servidor)', () => {
  it('sai antes do fim: cobra o mínimo contratado (2h = 2000)', () => {
    const q = buildQuote(stay, {}, at(101));
    expect(q.pricing.billedHours).toBe(2);
    expect(q.pricing.totalAmountDue).toBe(2000);
    expect(q.expectedEndAt).toBe(at(120).getTime());
    expect(q.serverNow).toBe(at(101).getTime());
  });
  it('à hora certa (2h10 depois) ainda são 2h; passada a tolerância, 3h', () => {
    expect(buildQuote(stay, {}, at(130)).pricing.billedHours).toBe(2);
    expect(buildQuote(stay, {}, at(131)).pricing.billedHours).toBe(3);
    expect(buildQuote(stay, {}, at(131)).pricing.totalAmountDue).toBe(3000);
  });
  it('um consumo inválido trava (não se confia no guardado)', () => {
    expect(() => stayPricingAt({ ...stay, consumptions: [{ productName: 'X', quantity: 0, unitPrice: 10 }] }, {}, at(60))).toThrow(/Consumo/);
  });
});

describe('priceChanged', () => {
  it('trava só quando o total do ecrã difere do do servidor', () => {
    expect(priceChanged(2000, 2000)).toBe(false);
    expect(priceChanged(2000, 2000.004)).toBe(false);
    expect(priceChanged(2000, 3000)).toBe(true);
    expect(priceChanged('abc', 3000)).toBe(true);
  });
  it('ecrã antigo (sem valor esperado) não trava', () => {
    expect(priceChanged(undefined, 3000)).toBe(false);
    expect(priceChanged(null, 3000)).toBe(false);
  });
});
