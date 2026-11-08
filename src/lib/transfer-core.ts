// Transferir stock entre localizações (página /inventory/transfer): contas puras, testadas.
import { sameLocation } from '@/lib/product-ref';
import { searchProducts } from '@/lib/quick-stock';

type P = { name: string; location?: string; stock?: number; reservedStock?: number; unit?: string; deletedAt?: string; category?: string };

export type TransferRow = { name: string; unit: string; category?: string; available: number; atDestination: number };

/** Os produtos com stock disponível na origem (o que se pode transferir), com quanto já há no destino. */
export function transferCandidates(products: P[], from: string, to: string): TransferRow[] {
    const live = products.filter((p) => !p.deletedAt);
    const avail = (p: P) => (Number(p.stock) || 0) - (Number(p.reservedStock) || 0);
    const rows = new Map<string, TransferRow>();
    for (const p of live) {
        if (!sameLocation(p.location, from)) continue;
        const r = rows.get(p.name) || { name: p.name, unit: p.unit || 'un', category: p.category, available: 0, atDestination: 0 };
        r.available += avail(p);
        rows.set(p.name, r);
    }
    for (const p of live) {
        const r = rows.get(p.name);
        if (r && to && sameLocation(p.location, to)) r.atDestination += Number(p.stock) || 0;
    }
    return [...rows.values()].filter((r) => r.available > 0).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

/** Pesquisa como na Venda Rápida; sem texto, a lista toda. */
export function filterCandidates(rows: TransferRow[], term: string): TransferRow[] {
    return term.trim() ? searchProducts(rows, term, 50) : rows;
}

/** Quantidade válida: entre 0 e o disponível (aceita "2,5"). */
export function clampQty(v: unknown, max: number): number {
    const n = Number(String(v ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(Math.round(n * 1000) / 1000, max);
}
