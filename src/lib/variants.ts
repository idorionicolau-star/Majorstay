// Variações de um produto (cor, textura, tamanho…) — lógica pura, sem Firebase nem React, para ser testada.
//
// Cada variação é um produto do catálogo como outro qualquer, com o nome "Base - Valor" ("Pavê Borbulha - Vermelho"):
// assim stock, preço, reservas, fotos, vendas, encomendas, produção e a pesquisa por voz funcionam sem alterações.
// O que as liga é `variantGroup` (o nome base) e `variantValues` (ex.: { Cor: "Vermelho", Textura: "Lisa" }).
import { nameKey } from '@/lib/catalog-view';

export type VariantOption = { name: string; values: string[] };
export type VariantValues = Record<string, string>;
export type PlannedVariant = { name: string; values: VariantValues };

/** Tipos de variação habituais (a pessoa pode escrever outro). */
export const SUGGESTED_OPTIONS = ['Cor', 'Textura', 'Tamanho', 'Acabamento', 'Modelo'] as const;
export const SUGGESTED_VALUES: Record<string, string[]> = {
  Cor: ['Branco', 'Preto', 'Cinzento', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Castanho', 'Bege'],
  Textura: ['Lisa', 'Rugosa', 'Borbulha', 'Estriada'],
  Tamanho: ['Pequeno', 'Médio', 'Grande'],
  Acabamento: ['Mate', 'Brilhante', 'Acetinado'],
};

/** Máximo de variações criadas de uma vez (2 tipos × 8 valores = 64 já é muito para um estaleiro). */
export const MAX_VARIANTS = 60;

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Tira espaços, apaga tipos/valores vazios e valores repetidos (ignora maiúsculas e acentos). */
export function cleanOptions(options: VariantOption[]): VariantOption[] {
  const seenNames = new Set<string>();
  const out: VariantOption[] = [];
  for (const o of options) {
    const name = clean(o.name);
    if (!name || seenNames.has(nameKey(name))) continue;
    seenNames.add(nameKey(name));
    const seen = new Set<string>();
    const values = o.values.map(clean).filter((v) => {
      const k = nameKey(v);
      if (!v || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (values.length) out.push({ name, values });
  }
  return out;
}

/** Quantas variações dá (produto cartesiano: 3 cores × 2 texturas = 6). 0 se não houver opções. */
export function countCombinations(options: VariantOption[]): number {
  const o = cleanOptions(options);
  return o.length ? o.reduce((t, x) => t * x.values.length, 1) : 0;
}

/** Todas as combinações, pela ordem dos tipos e dos valores. */
export function combinations(options: VariantOption[]): VariantValues[] {
  const o = cleanOptions(options);
  if (!o.length) return [];
  let acc: VariantValues[] = [{}];
  for (const opt of o) acc = acc.flatMap((a) => opt.values.map((v) => ({ ...a, [opt.name]: v })));
  return acc;
}

/** "Pavê Borbulha" + { Cor: "Vermelho", Textura: "Lisa" } → "Pavê Borbulha - Vermelho / Lisa" (pela ordem dos tipos). */
export function variantName(base: string, values: VariantValues, order?: string[]): string {
  const keys = order?.length ? order.filter((k) => k in values) : Object.keys(values);
  const parts = keys.map((k) => clean(values[k] || '')).filter(Boolean);
  const b = clean(base);
  return parts.length ? `${b} - ${parts.join(' / ')}` : b;
}

export type VariantPlan = {
  create: PlannedVariant[];
  /** variações que já existem no catálogo (ficam como estão) */
  existing: string[];
  tooMany: boolean;
};

/** O que criar: as combinações cujo nome ainda não existe no catálogo. */
export function planVariants(base: string, options: VariantOption[], existingNames: string[]): VariantPlan {
  const o = cleanOptions(options);
  const order = o.map((x) => x.name);
  const all = combinations(o);
  if (all.length > MAX_VARIANTS) return { create: [], existing: [], tooMany: true };
  const have = new Set(existingNames.map(nameKey));
  const create: PlannedVariant[] = [];
  const existing: string[] = [];
  for (const values of all) {
    const name = variantName(base, values, order);
    if (have.has(nameKey(name))) existing.push(name);
    else { create.push({ name, values }); have.add(nameKey(name)); }
  }
  return { create, existing, tooMany: false };
}

type Grouped = { name: string; variantGroup?: string };

/** Os produtos da mesma família (mesmo `variantGroup`), incluindo o próprio. */
export function siblingsOf<T extends Grouped>(product: Grouped, all: T[]): T[] {
  if (!product.variantGroup) return [];
  const k = nameKey(product.variantGroup);
  return all.filter((p) => p.variantGroup && nameKey(p.variantGroup) === k).sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' }));
}

/** Tipos e valores já usados por uma família (para sugerir ao acrescentar uma variação nova). */
export function optionsOfFamily(members: { variantValues?: VariantValues }[]): VariantOption[] {
  const map = new Map<string, string[]>();
  for (const m of members) {
    for (const [k, v] of Object.entries(m.variantValues || {})) {
      const list = map.get(k) || [];
      if (!list.some((x) => nameKey(x) === nameKey(v))) list.push(v);
      map.set(k, list);
    }
  }
  return [...map].map(([name, values]) => ({ name, values }));
}

/**
 * Enter numa pesquisa que só diz a família ("pavê 20") quando há várias variações: quais oferecer
 * ("Qual cor?"). Devolve [] quando não é preciso perguntar: o produto não tem família, só há uma
 * variação, ou a pesquisa já diz qual é ("pavê verm 20").
 */
export function variantChoice<T extends Grouped & { variantValues?: VariantValues }>(term: string, picked: T, pool: T[]): T[] {
  if (!picked.variantGroup) return [];
  const family = siblingsOf(picked, pool);
  if (family.length < 2) return [];
  const groupWords = nameKey(picked.variantGroup).split(/[^a-z0-9.,]+/).filter(Boolean);
  const words = nameKey(term).split(/[^a-z0-9.,]+/).filter(Boolean);
  // alguma palavra que não é do nome da família (ex.: "verm") = já escolheu a variação
  const extra = words.filter((w) => !groupWords.some((g) => g.startsWith(w) || w.startsWith(g)));
  return extra.length ? [] : family;
}

/** "Vermelho / Lisa" — o que distingue a variação dentro da família. */
export function variantLabel(p: { name: string; variantGroup?: string; variantValues?: VariantValues }): string {
  const v = Object.values(p.variantValues || {}).filter(Boolean).join(' / ');
  if (v) return v;
  const g = p.variantGroup ? clean(p.variantGroup) : '';
  return g && p.name.startsWith(`${g} - `) ? p.name.slice(g.length + 3) : p.name;
}

export type FamilyGroup<T> = { kind: 'family'; key: string; group: string; members: T[] };

/**
 * Inventário: junta as variações da mesma família (e da mesma localização) numa só entrada, no lugar
 * onde aparece a primeira. Uma família com uma só variação na lista fica como produto normal.
 */
export function groupFamilies<T extends Grouped & { location?: string }>(list: T[]): (T | FamilyGroup<T>)[] {
  const keyOf = (p: T) => (p.variantGroup ? `${nameKey(p.variantGroup)}|${p.location || ''}` : '');
  const count = new Map<string, T[]>();
  for (const p of list) {
    const k = keyOf(p);
    if (k) count.set(k, [...(count.get(k) || []), p]);
  }
  const out: (T | FamilyGroup<T>)[] = [];
  const placed = new Set<string>();
  for (const p of list) {
    const k = keyOf(p);
    const fam = k ? count.get(k)! : [];
    if (fam.length < 2) { out.push(p); continue; }
    if (placed.has(k)) continue;
    placed.add(k);
    const members = [...fam].sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' }));
    out.push({ kind: 'family', key: k, group: p.variantGroup!, members });
  }
  return out;
}

export const isFamilyGroup = <T,>(x: T | FamilyGroup<T>): x is FamilyGroup<T> => !!x && typeof x === 'object' && (x as FamilyGroup<T>).kind === 'family';
