// Lógica do catálogo de produtos, pura (sem Firebase nem React) para ser testada: pesquisa, filtros, ordenação,
// duplicados e ajuste de preços em massa.
import { normalizeString } from '@/lib/utils';
import { looksLikeBarcode, normalizeBarcode } from '@/lib/barcode';
import { searchProducts } from '@/lib/quick-stock';
import { approxProducts } from '@/lib/voice-approx';

export type CatalogLike = {
    id?: string;
    name: string;
    category?: string;
    price?: number;
    unit?: string;
    imageUrl?: string;
    cost?: number;
    barcode?: string;
    deletedAt?: string | null;
};

export type CatalogSort = 'relevance' | 'name' | 'price-asc' | 'price-desc' | 'category';

export const SORT_LABELS: Record<CatalogSort, string> = {
    relevance: 'Relevância',
    name: 'Nome (A–Z)',
    'price-asc': 'Preço: mais baixo',
    'price-desc': 'Preço: mais alto',
    category: 'Categoria',
};

/** Só os produtos que não estão na lixeira. */
export const activeCatalog = <T extends object>(items: T[] | null | undefined): T[] => (items || []).filter((i) => !(i as { deletedAt?: string | null }).deletedAt);

/** Chave para comparar nomes: sem acentos, maiúsculas nem espaços a mais. */
export const nameKey = (s: string) => normalizeString(s).replace(/\s+/g, ' ').trim();

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' });

/**
 * Pesquisa no catálogo: ignora acentos, aceita plural e gralhas de escrita, e procura no nome e na categoria.
 * Sem texto devolve tudo. Se nada bater, sugere os mais parecidos (pela forma como as palavras soam).
 */
export function searchCatalog<T extends CatalogLike>(items: T[], term: string): T[] {
    const t = term.trim();
    if (!t) return items;
    // um código lido (ou colado) procura por código de barras
    if (looksLikeBarcode(t)) {
        const code = sameCodeKey(t);
        const byCode = items.filter((i) => i.barcode && sameCodeKey(i.barcode) === code);
        if (byCode.length) return byCode;
    }
    const byNameHits = searchProducts(items, t, items.length);
    const seen = new Set<T>(byNameHits);
    // também por categoria: "tintas" mostra a categoria Tintas
    const tokens = nameKey(t).split(' ').filter(Boolean);
    const byCategory = items.filter((i) => !seen.has(i) && i.category && tokens.every((tok) => nameKey(i.category!).includes(tok)));
    const hits = [...byNameHits, ...byCategory];
    if (hits.length) return hits;
    return approxProducts(items, t, 30).filter((s) => s.score >= 0.6).map((s) => s.product);
}

export function filterCatalog<T extends CatalogLike>(items: T[], opts: { term?: string; category?: string; sort?: CatalogSort }): T[] {
    let list = items;
    if (opts.category && opts.category !== 'all') list = list.filter((i) => i.category === opts.category);
    list = searchCatalog(list, opts.term || '');
    const sort = opts.sort || 'relevance';
    const searching = !!opts.term?.trim();
    if (sort === 'relevance') return searching ? list : [...list].sort(byName); // com texto, a ordem é a da relevância
    const copy = [...list]; // nunca ordenar a lista original (vem do estado da app)
    if (sort === 'name') return copy.sort(byName);
    if (sort === 'price-asc') return copy.sort((a, b) => (a.price || 0) - (b.price || 0) || byName(a, b));
    if (sort === 'price-desc') return copy.sort((a, b) => (b.price || 0) - (a.price || 0) || byName(a, b));
    return copy.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'pt') || byName(a, b));
}

/** Um produto do catálogo com o mesmo nome (ignorando acentos/maiúsculas/espaços). */
export function findDuplicate<T extends { id?: string; name: string }>(items: T[], name: string, exceptId?: string): T | undefined {
    const key = nameKey(name);
    if (!key) return undefined;
    return items.find((i) => i.id !== exceptId && nameKey(i.name) === key);
}

/** Preço depois de subir/descer `pct` %, com 2 casas e nunca negativo. */
export function adjustPrice(price: number, pct: number): number {
    const next = (Number(price) || 0) * (1 + pct / 100);
    return Math.max(0, Math.round(next * 100) / 100);
}

/** Quantos produtos tem cada categoria. */
export function categoryCounts(items: { category?: string }[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category || '', (m.get(i.category || '') || 0) + 1);
    return m;
}

/** Valida uma percentagem de ajuste de preço escrita pela pessoa ("10", "-5", "7,5"). */
export function parsePct(raw: string): number | null {
    const n = parseFloat(String(raw).replace(',', '.'));
    return Number.isFinite(n) && n > -100 && n <= 1000 ? n : null;
}

type InventoryLite = { name: string; category?: string; price?: number; unit?: string; lowStockThreshold?: number; criticalStockThreshold?: number; deletedAt?: string | null };

/**
 * "Sincronizar inventário": o que falta no catálogo. Um produto por nome (ignora acentos/maiúsculas), mesmo que
 * esteja em vários locais, e só os que não estão na lixeira. Devolve também as categorias que ainda não existem.
 */
export function buildSyncPlan(inventory: InventoryLite[], catalog: { name: string }[], categories: string[]) {
    const have = new Set(catalog.map((c) => nameKey(c.name)));
    const haveCats = new Set(categories.map(nameKey));
    const toAdd = new Map<string, InventoryLite>();
    for (const p of inventory) {
        if (p.deletedAt) continue;
        const key = nameKey(p.name);
        if (!key || have.has(key) || toAdd.has(key)) continue;
        toAdd.set(key, p);
    }
    const products = [...toAdd.values()].map((p) => ({
        name: p.name.trim(),
        category: (p.category || '').trim() || 'Geral',
        price: p.price || 0,
        unit: p.unit || 'un',
        lowStockThreshold: p.lowStockThreshold || 0,
        criticalStockThreshold: p.criticalStockThreshold || 0,
    }));
    const newCategories = [...new Set(products.map((p) => p.category))].filter((c) => !haveCats.has(nameKey(c)));
    return { products, newCategories };
}

/** Código sem espaços/hífenes e sem zeros à esquerda (UPC-A e EAN-13 do mesmo produto comparam iguais). */
export const sameCodeKey = (raw: string) => {
    const c = normalizeBarcode(raw);
    return /^\d+$/.test(c) ? c.replace(/^0+/, '') : c;
};

/** Outro produto do catálogo com o mesmo código de barras. */
export function findBarcodeClash<T extends { id?: string; barcode?: string }>(items: T[], code: string, exceptId?: string): T | undefined {
    const key = sameCodeKey(code);
    if (!key) return undefined;
    return items.find((i) => i.id !== exceptId && i.barcode && sameCodeKey(i.barcode) === key);
}

/** Margem em % sobre o preço de venda (null se não houver custo ou preço). */
export function marginPct(price?: number, cost?: number): number | null {
    const p = Number(price) || 0, c = Number(cost) || 0;
    if (p <= 0 || c <= 0) return null;
    return Math.round(((p - c) / p) * 1000) / 10;
}

export type PriceChange = { at: string; from: number; to: number; by?: string };
export const MAX_PRICE_HISTORY = 20;

/** Acrescenta uma alteração de preço ao histórico (guarda só as últimas 20; ignora quem não mudou o preço). */
export function pushPriceHistory(history: PriceChange[] | undefined, change: PriceChange): PriceChange[] {
    const list = history || [];
    if (change.from === change.to) return list;
    return [...list, change].slice(-MAX_PRICE_HISTORY);
}

/** Nome para uma cópia ("Bloco 15 (cópia)", "Bloco 15 (cópia 2)"…) que ainda não exista. */
export function copyName(items: { name: string }[], name: string): string {
    const base = name.replace(/\s*\(cópia(?: \d+)?\)\s*$/i, '').trim();
    const taken = new Set(items.map((i) => nameKey(i.name)));
    let candidate = `${base} (cópia)`;
    for (let n = 2; taken.has(nameKey(candidate)); n++) candidate = `${base} (cópia ${n})`;
    return candidate;
}
