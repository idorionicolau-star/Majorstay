/**
 * Pratos do dia: sem ingredientes nem stock. O recepcionista/gerente diz quantas doses há hoje;
 * cada pedido confirmado desconta 1; a 0 o prato fica "Esgotado". A quantidade volta a zero todas as manhãs (05:00).
 */
export const DISH_PREFIX = 'dish:';

export const isDishRef = (id: unknown): boolean => typeof id === 'string' && id.startsWith(DISH_PREFIX);
export const dishIdOf = (ref: string): string => ref.slice(DISH_PREFIX.length);

/** Dia da cozinha: vira às 05:00 (hora de Maputo), para não zerar à meia-noite com hóspedes a pedir. */
export function dishDayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + 2 * 3600 * 1000 - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Doses disponíveis agora: a quantidade só vale no dia em que foi definida. */
export function dishAvailable(d: { available?: unknown; availableDay?: unknown; active?: unknown; deletedAt?: unknown } | null | undefined, now: Date = new Date()): number {
  if (!d || d.deletedAt || d.active === false) return 0;
  if (d.availableDay !== dishDayKey(now)) return 0;
  const n = Math.floor(Number(d.available));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
