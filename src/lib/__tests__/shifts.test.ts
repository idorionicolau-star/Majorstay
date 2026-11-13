import { describe, it, expect } from 'vitest';
import { cashDifference, dayKeyMaputo, payBucket, summarizeShiftSales } from '../shifts';

describe('turnos de caixa', () => {
  it('o dia é o de Maputo (UTC+2)', () => {
    expect(dayKeyMaputo(new Date('2026-11-12T21:59:00Z'))).toBe('2026-11-12');
    expect(dayKeyMaputo(new Date('2026-11-12T22:00:00Z'))).toBe('2026-11-13');
  });

  it('classifica as formas de pagamento', () => {
    expect(payBucket('Dinheiro')).toBe('cash');
    expect(payBucket('M-Pesa / E-Mola')).toBe('mobile');
    expect(payBucket('POS / Cartão')).toBe('card');
    expect(payBucket('Transferência')).toBe('other');
  });

  it('soma só as vendas do funcionário dentro do turno', () => {
    const open = new Date('2026-11-12T08:00:00Z');
    const until = new Date('2026-11-12T16:00:00Z');
    const t = (h: number) => new Date(`2026-11-12T${String(h).padStart(2, '0')}:00:00Z`);
    const sales = [
      { soldBy: 'Ana', paymentMethod: 'Dinheiro', amountPaid: 500, timestamp: t(9) },
      { soldBy: 'Ana', paymentMethod: 'M-Pesa / E-Mola', amountPaid: 300, timestamp: t(10) },
      { soldBy: 'Ana', paymentMethod: 'Dinheiro', amountPaid: 100, timestamp: t(7) }, // antes de abrir
      { soldBy: 'Ana', paymentMethod: 'Dinheiro', amountPaid: 100, timestamp: t(17) }, // depois
      { soldBy: 'Rui', paymentMethod: 'Dinheiro', amountPaid: 900, timestamp: t(11) }, // outro funcionário
      { soldBy: 'Ana', paymentMethod: 'POS / Cartão', totalValue: 200, timestamp: { seconds: t(12).getTime() / 1000 } },
    ];
    const r = summarizeShiftSales(sales, 'Ana', open, until);
    expect(r).toEqual({ cash: 500, mobile: 300, card: 200, other: 0, total: 1000, count: 3 });
  });

  it('diferença: negativo quando falta dinheiro', () => {
    expect(cashDifference(1000, 500, 1400)).toEqual({ expectedCash: 1500, difference: -100 });
    expect(cashDifference(1000, 500, 1500).difference).toBe(0);
    expect(cashDifference(0, 0, 50).difference).toBe(50);
  });
});
