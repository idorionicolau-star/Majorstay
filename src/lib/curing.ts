// Secagem: o betão fica "a secar" alguns dias depois de produzido. Esse stock já conta no inventário
// (foi registado ao produzir), mas ainda não se pode carregar. Tudo derivado da data da produção + dias
// de secagem da empresa, por isso funciona também com a produção já registada. Puro, testado.

export const DEFAULT_CURING_DAYS = 3;

export type ProductionLite = { productName: string; quantity: number; date: string; location?: string; deletedAt?: string };
export type PendingSale = { id: string; productName: string; quantity: number; date: string; location?: string };
export type CuringBatch = { name: string; location: string; qty: number; readyAt: Date };

/** Num só local, "Principal" e "" são o mesmo sítio (ver sameLocation em lib/product-ref). */
const loc = (l?: string | null) => (!l || l === 'Principal' ? '' : l);

const key = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Início do dia (hora local) em que o lote fica pronto: dia da produção + dias de secagem. */
export function readyDate(productionDate: string, curingDays: number): Date {
  const d = new Date(productionDate.length <= 10 ? `${productionDate}T00:00:00` : productionDate);
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + Math.max(0, Math.round(curingDays)));
  return out;
}

/** Lotes ainda a secar (pronto no futuro), mais cedo primeiro. */
export function curingBatches(productions: ProductionLite[], now: Date, curingDays: number): CuringBatch[] {
  if (!(curingDays > 0)) return [];
  return productions
    .filter((p) => !p.deletedAt && p.quantity > 0 && p.date)
    .map((p) => ({ name: p.productName, location: loc(p.location), qty: p.quantity, readyAt: readyDate(p.date, curingDays) }))
    .filter((b) => !isNaN(b.readyAt.getTime()) && b.readyAt.getTime() > now.getTime())
    .sort((a, b) => a.readyAt.getTime() - b.readyAt.getTime());
}

/** Quantidade deste produto (neste local) ainda a secar. */
export function curingQty(batches: CuringBatch[], name: string, location?: string): number {
  const k = key(name);
  return batches.filter((b) => key(b.name) === k && b.location === loc(location)).reduce((t, b) => t + b.qty, 0);
}

/** Quando fica pronto o próximo lote deste produto (ou null). */
export function nextReady(batches: CuringBatch[], name: string, location?: string): Date | null {
  const k = key(name);
  return batches.find((b) => key(b.name) === k && b.location === loc(location))?.readyAt ?? null;
}

/** Pronto a carregar = o que há em stock menos o que ainda seca (nunca negativo). */
export function readyQty(stock: number, batches: CuringBatch[], name: string, location?: string): number {
  return Math.max(0, (stock || 0) - curingQty(batches, name, location));
}

export type PickupStatus =
  | { state: 'ready' }
  | { state: 'curing'; readyAt: Date }
  /** nem com tudo a secar há peças suficientes: falta produzir */
  | { state: 'short' };

/**
 * Para cada venda paga por levantar (a mais antiga primeiro), diz se já se pode carregar,
 * ou quando fica pronta. As mais antigas ficam com as peças prontas primeiro.
 */
export function allocatePickups(
  pending: PendingSale[],
  stockOf: (name: string, location?: string) => number,
  batches: CuringBatch[],
): Map<string, PickupStatus> {
  const out = new Map<string, PickupStatus>();
  const groups = new Map<string, PendingSale[]>();
  for (const s of pending) {
    const g = `${key(s.productName)}|${loc(s.location)}`;
    groups.set(g, [...(groups.get(g) || []), s]);
  }
  for (const list of groups.values()) {
    const { productName, location } = list[0];
    const stock = stockOf(productName, location);
    const pool = readyQty(stock, batches, productName, location);
    const mine = batches.filter((b) => key(b.name) === key(productName) && b.location === loc(location));
    let demand = 0;
    for (const s of [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
      demand += s.quantity;
      if (demand <= pool) { out.set(s.id, { state: 'ready' }); continue; }
      let released = 0;
      let eta: Date | null = null;
      for (const b of mine) {
        released += b.qty;
        if (pool + released >= demand) { eta = b.readyAt; break; }
      }
      out.set(s.id, eta ? { state: 'curing', readyAt: eta } : { state: 'short' });
    }
  }
  return out;
}
