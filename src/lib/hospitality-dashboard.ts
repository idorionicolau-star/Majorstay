import type { Sale } from './types';

/**
 * Totais do dashboard de hotelaria (MajorStay), calculados a partir das vendas do Caixa.
 * - "Quartos": vendas geradas no check-out (produto "Estadia: …"), que já incluem os consumos lançados no quarto.
 * - "Bar": as restantes vendas (vendas directas do Lounge).
 * Fora ficam as vendas apagadas, as proformas e as cotações. O valor é o que foi pago (ou o total, se não houver pago).
 */

export type DaySummary = {
  total: number;
  roomsTotal: number;
  barTotal: number;
  tickets: number;
};

export type DayBar = {
  /** Dia no formato AAAA-MM-DD (hora local). */
  key: string;
  /** Dia da semana abreviado (ex.: "seg"). */
  label: string;
  total: number;
};

const isStaySale = (s: Sale) => (s.productName || '').startsWith('Estadia:');

const revenueOf = (s: Sale) => Number(s.amountPaid ?? s.totalValue ?? 0) || 0;

const isCounted = (s: Sale) =>
  !s.deletedAt && s.documentType !== 'Factura Proforma' && s.documentType !== 'Cotação';

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * O dia em que a venda aconteceu: usa a hora registada (timestamp) quando existe e, se não, o campo `date`.
 * Um `date` do tipo AAAA-MM-DD lê-se como dia local (não como meia-noite UTC), para não saltar de dia.
 */
export function saleDay(sale: Sale): Date | null {
  const ts: unknown = sale.timestamp;
  if (ts) {
    const withToDate = ts as { toDate?: () => Date };
    const d = typeof withToDate.toDate === 'function' ? withToDate.toDate() : new Date(ts as string | number | Date);
    if (!isNaN(d.getTime())) return d;
  }
  if (!sale.date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sale.date);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(sale.date);
  return isNaN(d.getTime()) ? null : d;
}

export function summarizeDay(sales: Sale[], now: Date = new Date()): DaySummary {
  const today = dayKey(now);
  let roomsTotal = 0;
  let barTotal = 0;
  const tickets = new Set<string>();

  for (const s of sales || []) {
    if (!isCounted(s)) continue;
    const d = saleDay(s);
    if (!d || dayKey(d) !== today) continue;
    const value = revenueOf(s);
    if (isStaySale(s)) roomsTotal += value;
    else barTotal += value;
    tickets.add(s.guideNumber || s.id);
  }

  return { total: roomsTotal + barTotal, roomsTotal, barTotal, tickets: tickets.size };
}

/** Os últimos `days` dias (do mais antigo para hoje), com o total recebido em cada um. */
export function lastDays(sales: Sale[], now: Date = new Date(), days = 7): DayBar[] {
  const bars: DayBar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    bars.push({ key: dayKey(d), label: d.toLocaleDateString('pt-MZ', { weekday: 'short' }), total: 0 });
  }
  const byKey = new Map(bars.map((b) => [b.key, b]));

  for (const s of sales || []) {
    if (!isCounted(s)) continue;
    const d = saleDay(s);
    if (!d) continue;
    const bar = byKey.get(dayKey(d));
    if (bar) bar.total += revenueOf(s);
  }

  return bars;
}
