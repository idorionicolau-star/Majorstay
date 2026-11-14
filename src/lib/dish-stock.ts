import type { Product } from '@/lib/types';

type StockLike = Partial<Pick<Product, 'stock' | 'reservedStock' | 'isDish' | 'category' | 'rawIngredientId' | 'rawQuantityPerPortion' | 'soldByWeight'>> & { id?: string; instanceId?: string };

/** É um prato (confecionado) e não um produto de prateleira. */
export const isDishProduct = (p: Partial<Pick<Product, 'isDish' | 'category'>>): boolean =>
  Boolean(p.isDish || (p.category || '').toLowerCase().includes('prato'));

/**
 * Quantidade realmente disponível para vender.
 * - Produto normal: stock - reservado.
 * - Prato com matéria-prima ligada: doses (ou kg, se vendido ao peso) que a matéria-prima ainda dá.
 * - Prato sem matéria-prima: null (não há um número real; o "999" antigo era só um valor de enchimento).
 */
export function availableUnits(p: StockLike, all: StockLike[]): number | null {
  if (!isDishProduct(p)) return (Number(p.stock) || 0) - (Number(p.reservedStock) || 0);
  if (!p.rawIngredientId) return null;
  const raw = all.find((r) => (r.id === p.rawIngredientId || r.instanceId === p.rawIngredientId) && !(r as { deletedAt?: unknown }).deletedAt);
  if (!raw) return 0;
  const rawStock = Math.max(0, (Number(raw.stock) || 0) - (Number(raw.reservedStock) || 0));
  if (p.soldByWeight) return Math.round(rawStock * 100) / 100; // kg
  const portion = Number(p.rawQuantityPerPortion) || 0;
  if (portion <= 0) return null;
  return Math.max(0, Math.floor(rawStock / portion));
}

/** Para mostrar: "12", "3,5" ou "" quando não há número real. */
export function formatAvailable(n: number | null): string {
  if (n === null) return '';
  return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-PT', { maximumFractionDigits: 2 });
}
