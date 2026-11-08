import { categorizeLocally, matchExistingCategory } from '@/lib/categorize-local';

// Motor único da criação de produtos: limpa o nome, encontra produtos iguais ou parecidos
// (no inventário e no catálogo), sugere a categoria e diz o que falta gravar no catálogo.
// É puro (sem Firebase) para poder ser testado e usado em qualquer ecrã.

export type ProductLite = { name: string; category?: string; location?: string; unit?: string; price?: number };

export type NameMatch = {
  name: string;
  category?: string;
  unit?: string;
  price?: number;
  location?: string;
  /** exact = o mesmo nome; similar = quase o mesmo (plural, erro de escrita, falta ou sobra de medida) */
  kind: 'exact' | 'similar';
  source: 'inventory' | 'catalog';
  score: number;
};

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "  cimento   32.5n " → "Cimento 32.5n" */
export function cleanProductName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

const stem = (w: string) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w);

type Tokens = { words: string[]; nums: string[] };

function tokens(name: string): Tokens {
  const parts = strip(name).replace(/(\d),(\d)/g, '$1.$2').split(/[^a-z0-9.]+/).map((p) => p.replace(/^\.+|\.+$/g, '')).filter(Boolean);
  const words: string[] = [];
  const nums: string[] = [];
  for (const p of parts) {
    // "15x40" ou "32.5n" contam como medida; palavras puras como nome
    if (/\d/.test(p)) nums.push(p);
    else if (p.length > 1) words.push(stem(p));
  }
  return { words, nums };
}

/** Chave estável: ignora maiúsculas, acentos, plural e espaços a mais. */
export const nameKey = (name: string) => {
  const t = tokens(name);
  return [...t.words, ...t.nums].join(' ');
};

function edit(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

/** Duas palavras são "a mesma" se forem iguais ou diferirem num erro de escrita (só em palavras longas). */
function sameWord(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5) return false;
  return edit(a, b) <= (Math.max(a.length, b.length) >= 9 ? 2 : 1);
}

/**
 * 0 = nada a ver · 1 = o mesmo produto.
 * Medidas diferentes são produtos diferentes ("Bloco 15" ≠ "Bloco 20"); se só um dos lados tem medida
 * ("Cimento" / "Cimento 32.5N") é parecido mas a pessoa decide.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.words.length || !tb.words.length) return nameKey(a) && nameKey(a) === nameKey(b) ? 1 : 0;

  if (ta.nums.length && tb.nums.length) {
    const same = ta.nums.length === tb.nums.length && ta.nums.every((n) => tb.nums.includes(n));
    if (!same) return 0;
  }

  const [small, big] = ta.words.length <= tb.words.length ? [ta.words, tb.words] : [tb.words, ta.words];
  const hits = small.filter((w) => big.some((x) => sameWord(w, x))).length;
  if (hits < small.length) return 0; // todas as palavras do nome mais curto têm de existir no outro
  const wordScore = hits / Math.max(ta.words.length, tb.words.length);
  const oneSideMissingNumber = (ta.nums.length === 0) !== (tb.nums.length === 0);
  const identical = nameKey(a) === nameKey(b);
  if (identical) return 1;
  return Math.min(0.95, wordScore * (oneSideMissingNumber ? 0.85 : 1));
}

/**
 * Produtos iguais ou parecidos ao nome que se quer criar, no inventário e no catálogo.
 * `location`: o "exacto" só conta no mesmo local (o mesmo nome noutro local é uma deslocação, não um duplicado).
 */
export function findNameMatches(
  name: string,
  pools: { inventory: ProductLite[]; catalog: ProductLite[] },
  opts: { minScore?: number; limit?: number } = {},
): NameMatch[] {
  const minScore = opts.minScore ?? 0.6;
  const out: NameMatch[] = [];
  const seen = new Set<string>();
  const scan = (list: ProductLite[], source: NameMatch['source']) => {
    for (const p of list) {
      if (!p.name) continue;
      const score = nameSimilarity(name, p.name);
      if (score < minScore) continue;
      const key = `${source}|${nameKey(p.name)}|${source === 'inventory' ? strip(p.location || '') : ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: p.name, category: p.category, unit: p.unit, price: p.price, location: p.location,
        kind: score >= 1 ? 'exact' : 'similar', source, score,
      });
    }
  };
  scan(pools.inventory, 'inventory');
  scan(pools.catalog, 'catalog');
  return out.sort((a, b) => b.score - a.score || (a.source === 'inventory' ? -1 : 1)).slice(0, opts.limit ?? 4);
}

export type CategorySuggestion = {
  category: string;
  /** de onde veio: produto parecido, palavra-chave de construção, ou nada (fica "Geral") */
  source: 'similar' | 'keyword' | 'none';
  /** a categoria ainda não existe no catálogo e vai ser criada */
  isNew: boolean;
};

export function suggestCategory(name: string, existingCategories: string[], products: ProductLite[]): CategorySuggestion {
  const local = categorizeLocally(name, existingCategories, products);
  if (!local) return { category: 'Geral', source: 'none', isNew: false };
  const existing = matchExistingCategory(local.category, existingCategories);
  return { category: existing || local.category, source: local.source, isNew: !existing };
}

/** Unidade habitual do material (saco de cimento, metro de cabo…). Só se não houver dados melhores. */
const UNIT_HINTS: [RegExp, string][] = [
  [/\b(cimento|cal|argamassa|cola|betumite)\b/, 'saco'],
  [/\b(areia|pedra|brita|burgau|saibro)\b/, 'm³'],
  [/\b(cabo|fio|tubo|cano|vara|varao|perfil|ripa|caibro)\b/, 'm'],
  [/\b(tinta|verniz|diluente)\b/, 'L'],
  [/\b(prego|pregos|parafuso|parafusos)\b/, 'kg'],
];
export function guessUnit(name: string, available: string[]): string {
  const n = strip(name);
  const hit = UNIT_HINTS.find(([re]) => re.test(n));
  if (hit && available.some((u) => u === hit[1])) return hit[1];
  return 'un';
}

export type CatalogWrites = {
  /** acrescentar ao catálogo? (false = já lá está) */
  addProduct: boolean;
  /** criar a categoria no catálogo? (false = já existe) */
  addCategory: boolean;
  category: string;
};

/** O que falta gravar no catálogo para este produto aparecer em todo o sistema. */
export function planCatalogWrites(args: {
  name: string;
  category: string;
  catalogProducts: ProductLite[];
  catalogCategories: string[];
}): CatalogWrites {
  const key = nameKey(args.name);
  const category = matchExistingCategory(args.category, args.catalogCategories) || args.category.trim() || 'Geral';
  return {
    addProduct: !args.catalogProducts.some((p) => nameKey(p.name) === key),
    addCategory: !args.catalogCategories.some((c) => strip(c).trim() === strip(category).trim()),
    category,
  };
}
