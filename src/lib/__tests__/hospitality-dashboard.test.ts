import { describe, it, expect } from 'vitest';
import type { Sale } from '../types';
import { summarizeDay, lastDays, saleDay } from '../hospitality-dashboard';

const NOW = new Date(2026, 10, 9, 15, 0, 0); // 9 Nov 2026, 15:00 (hora local)

function sale(partial: Partial<Sale>): Sale {
  return {
    id: partial.id || Math.random().toString(36).slice(2),
    date: '2026-11-09',
    productId: 'p1',
    productName: 'Cerveja 2M',
    quantity: 1,
    unitPrice: 80,
    subtotal: 80,
    totalValue: 80,
    soldBy: 'u1',
    guideNumber: partial.guideNumber || `G-${Math.random().toString(36).slice(2)}`,
    status: 'Pago',
    documentType: 'Venda a Dinheiro',
    ...partial,
  } as Sale;
}

describe('hospitality-dashboard', () => {
  describe('summarizeDay', () => {
    it('separa as estadias (quartos) das vendas directas do bar', () => {
      const sales = [
        sale({ productName: 'Estadia: Quarto 1', totalValue: 500, amountPaid: 500 }),
        sale({ productName: 'Estadia: Quarto 2 + Consumos Bar', totalValue: 700, amountPaid: 700 }),
        sale({ productName: 'Cerveja 2M', totalValue: 160, amountPaid: 160 }),
      ];
      const r = summarizeDay(sales, NOW);
      expect(r.roomsTotal).toBe(1200);
      expect(r.barTotal).toBe(160);
      expect(r.total).toBe(1360);
      expect(r.tickets).toBe(3);
    });

    it('ignora vendas apagadas, proformas e cotações', () => {
      const sales = [
        sale({ totalValue: 100, amountPaid: 100 }),
        sale({ totalValue: 999, deletedAt: '2026-11-09T10:00:00Z' }),
        sale({ totalValue: 888, documentType: 'Factura Proforma' }),
        sale({ totalValue: 777, documentType: 'Cotação' }),
      ];
      expect(summarizeDay(sales, NOW).total).toBe(100);
    });

    it('conta o valor pago, e o total só quando não há valor pago', () => {
      const sales = [
        sale({ totalValue: 300, amountPaid: 100 }),
        sale({ totalValue: 50, amountPaid: undefined }),
      ];
      expect(summarizeDay(sales, NOW).total).toBe(150);
    });

    it('não conta vendas de outros dias', () => {
      const sales = [sale({ date: '2026-11-08', totalValue: 500 }), sale({ date: '2026-11-09', totalValue: 40 })];
      expect(summarizeDay(sales, NOW).total).toBe(40);
    });

    it('prefere a hora registada (timestamp) ao campo date', () => {
      const sales = [sale({ date: '2026-11-08', timestamp: new Date(2026, 10, 9, 1, 30), totalValue: 90 })];
      expect(summarizeDay(sales, NOW).total).toBe(90);
    });

    it('aceita timestamps do Firestore (toDate)', () => {
      const ts = { toDate: () => new Date(2026, 10, 9, 8, 0) };
      const sales = [sale({ date: '2026-11-01', timestamp: ts, totalValue: 25 })];
      expect(summarizeDay(sales, NOW).total).toBe(25);
    });

    it('devolve zeros sem vendas', () => {
      expect(summarizeDay([], NOW)).toEqual({ total: 0, roomsTotal: 0, barTotal: 0, tickets: 0 });
    });
  });

  describe('lastDays', () => {
    it('devolve 7 dias, do mais antigo para hoje', () => {
      const bars = lastDays([], NOW, 7);
      expect(bars).toHaveLength(7);
      expect(bars[0].key).toBe('2026-11-03');
      expect(bars[6].key).toBe('2026-11-09');
    });

    it('soma cada venda no seu dia e ignora o que está fora da janela', () => {
      const sales = [
        sale({ date: '2026-11-09', totalValue: 100 }),
        sale({ date: '2026-11-09', totalValue: 50 }),
        sale({ date: '2026-11-05', totalValue: 70 }),
        sale({ date: '2026-10-20', totalValue: 9999 }),
      ];
      const bars = lastDays(sales, NOW, 7);
      expect(bars.find((b) => b.key === '2026-11-09')?.total).toBe(150);
      expect(bars.find((b) => b.key === '2026-11-05')?.total).toBe(70);
      expect(bars.reduce((t, b) => t + b.total, 0)).toBe(220);
    });
  });

  describe('saleDay', () => {
    it('lê AAAA-MM-DD como dia local', () => {
      const d = saleDay(sale({ date: '2026-11-09', timestamp: undefined }));
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(10);
      expect(d?.getDate()).toBe(9);
    });

    it('devolve null sem data utilizável', () => {
      expect(saleDay(sale({ date: '', timestamp: undefined }))).toBeNull();
    });
  });
});

import { summarizeWindow } from '../hospitality-dashboard';

describe('summarizeWindow (totais do turno)', () => {
  const sale = (id: string, iso: string, v: number, extra: Record<string, unknown> = {}) =>
    ({ id, productName: 'Cerveja', amountPaid: v, totalValue: v, timestamp: iso, soldBy: 'Ana', ...extra }) as any;
  const from = new Date('2026-11-23T17:00:00Z');
  const to = new Date('2026-11-24T05:00:00Z');

  it('conta só o que aconteceu entre a abertura e o fecho, mesmo atravessando a meia-noite', () => {
    const sales = [
      sale('a', '2026-11-23T16:59:00Z', 100),
      sale('b', '2026-11-23T22:30:00Z', 200),
      sale('c', '2026-11-24T01:00:00Z', 300, { productName: 'Estadia: Quarto 1' }),
      sale('d', '2026-11-24T05:01:00Z', 400),
    ];
    const r = summarizeWindow(sales, from, to);
    expect(r).toMatchObject({ total: 500, barTotal: 200, roomsTotal: 300, tickets: 2 });
  });

  it('só as vendas de um funcionário, e ignora apagadas e proformas', () => {
    const sales = [
      sale('a', '2026-11-23T20:00:00Z', 100),
      sale('b', '2026-11-23T21:00:00Z', 50, { soldBy: 'Rui' }),
      sale('c', '2026-11-23T21:30:00Z', 70, { deletedAt: '2026-11-23T22:00:00Z' }),
      sale('d', '2026-11-23T21:40:00Z', 80, { documentType: 'Factura Proforma' }),
    ];
    expect(summarizeWindow(sales, from, to, 'Ana').total).toBe(100);
    expect(summarizeWindow(sales, from, to).total).toBe(150);
  });
});
