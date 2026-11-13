// Turnos de caixa dos recepcionistas: regras puras (testáveis), usadas pela rota /api/shifts.

export type PayBucket = 'cash' | 'mobile' | 'card' | 'other';
export type ShiftTotals = { cash: number; mobile: number; card: number; other: number; total: number; count: number };

/** Dia civil em Maputo (UTC+2, sem hora de verão) no formato AAAA-MM-DD: um turno por pessoa por dia. */
export function dayKeyMaputo(d: Date = new Date()): string {
  return new Date(d.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

export function payBucket(method: unknown): PayBucket {
  const m = String(method || '').toLowerCase();
  if (m.includes('dinheiro') || m.includes('cash') || m.includes('numer')) return 'cash';
  if (m.includes('pesa') || m.includes('mola') || m.includes('mkesh') || m.includes('móvel') || m.includes('movel')) return 'mobile';
  if (m.includes('pos') || m.includes('cart')) return 'card';
  return 'other';
}

type SaleLike = { soldBy?: string; paymentMethod?: string; amountPaid?: number; totalValue?: number; timestamp?: any };

function toMs(ts: any): number {
  if (!ts) return NaN;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return new Date(ts).getTime();
}

/** O que o funcionário recebeu nas vendas feitas entre a abertura e `until` (mesmo critério do "Hoje no caixa"). */
export function summarizeShiftSales(sales: SaleLike[], employeeName: string, openedAt: Date, until: Date): ShiftTotals {
  const t: ShiftTotals = { cash: 0, mobile: 0, card: 0, other: 0, total: 0, count: 0 };
  const from = openedAt.getTime();
  const to = until.getTime();
  for (const s of sales) {
    if ((s.soldBy || '') !== employeeName) continue;
    const ms = toMs(s.timestamp);
    if (!Number.isFinite(ms) || ms < from || ms > to) continue;
    const paid = Number(s.amountPaid ?? s.totalValue) || 0;
    t[payBucket(s.paymentMethod)] += paid;
    t.total += paid;
    t.count += 1;
  }
  return t;
}

/** Diferença do dinheiro: contado menos esperado (fundo de caixa + vendas em dinheiro). Negativo = falta dinheiro. */
export function cashDifference(openingCash: number, cashSales: number, countedCash: number): { expectedCash: number; difference: number } {
  const expectedCash = (Number(openingCash) || 0) + (Number(cashSales) || 0);
  return { expectedCash, difference: (Number(countedCash) || 0) - expectedCash };
}
