// Registar produção (página /production/new): datas, pesquisa no catálogo e "mais produzidos". Puro, testado.
import { searchProducts } from '@/lib/quick-stock';
import { ingredientRequiredQty } from '@/lib/order-stock';
import { groupFamilies, type FamilyGroup } from '@/lib/variants';

const DAY = 86_400_000;
/** Dia de calendário de Maputo (UTC+2) em AAAA-MM-DD. */
export const mzDay = (d: Date) => new Date(d.getTime() + 2 * 3600_000).toISOString().slice(0, 10);

/** Hoje / ontem (em Maputo). */
export const todayMz = (now = new Date()) => mzDay(now);
export const yesterdayMz = (now = new Date()) => mzDay(new Date(now.getTime() - DAY));

/** Data de produção válida: AAAA-MM-DD, não no futuro e no máximo 1 ano para trás. */
export function validProductionDate(v: string, now = new Date()): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
    const today = todayMz(now);
    const oldest = mzDay(new Date(now.getTime() - 366 * DAY));
    return v <= today && v >= oldest;
}

/** "hoje", "ontem" ou "12/10/2026". */
export function dateLabel(v: string, now = new Date()): string {
    if (v === todayMz(now)) return 'hoje';
    if (v === yesterdayMz(now)) return 'ontem';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
}

type Cat = { name: string; variantGroup?: string; unit?: string };

/** O catálogo para escolher: com texto, a pesquisa da Venda Rápida; sem texto, tudo por ordem. Variações juntas por família. */
export function catalogChoices<T extends Cat>(catalog: T[], term: string): (T | FamilyGroup<T>)[] {
    const list = term.trim()
        ? searchProducts(catalog, term, 60)
        : [...catalog].sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' }));
    return groupFamilies(list);
}

/** Os mais produzidos nos últimos `days` dias (por número de registos), que ainda existem no catálogo. */
export function mostProduced(productions: { productName: string; date?: string; deletedAt?: string }[], catalogNames: Set<string>, n = 6, now = new Date(), days = 60): string[] {
    const since = mzDay(new Date(now.getTime() - days * DAY));
    const count = new Map<string, number>();
    for (const p of productions) {
        if (p.deletedAt || !p.productName || !catalogNames.has(p.productName)) continue;
        if (p.date && p.date.slice(0, 10) < since) continue;
        count.set(p.productName, (count.get(p.productName) || 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt')).slice(0, n).map(([name]) => name);
}

// ---------------------------------------------------------------- matéria-prima usada


/** Uma matéria-prima gasta numa produção (o que ficou registado — pode não ser exactamente a receita). */
export type MaterialLine = { rawMaterialId: string; name: string; quantity: number; unit?: string };

type RecipeLike = { ingredients: { rawMaterialId: string; rawMaterialName: string; quantity: number; yieldPerUnit?: number }[] };

/** O que a receita manda gastar para `produced` unidades (o ponto de partida, que se pode corrigir). */
export function recipeMaterials(recipe: RecipeLike | undefined, produced: number, raw: { id: string; unit?: string; name?: string }[] = []): MaterialLine[] {
    if (!recipe || !(produced > 0)) return [];
    return cleanMaterials(recipe.ingredients.map((g) => {
        const r = raw.find((x) => x.id === g.rawMaterialId);
        return { rawMaterialId: g.rawMaterialId, name: r?.name || g.rawMaterialName, quantity: ingredientRequiredQty(g, produced), unit: r?.unit };
    }));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Junta a mesma matéria-prima, tira as linhas a 0 e arredonda (3 casas). */
export function cleanMaterials(lines: MaterialLine[]): MaterialLine[] {
    const by = new Map<string, MaterialLine>();
    for (const l of lines) {
        const q = Number(l.quantity);
        if (!l.rawMaterialId || !Number.isFinite(q) || q <= 0) continue;
        const cur = by.get(l.rawMaterialId);
        by.set(l.rawMaterialId, cur ? { ...cur, quantity: round(cur.quantity + q) } : { ...l, quantity: round(q) });
    }
    return [...by.values()];
}

/**
 * Ao editar uma produção: quanto muda o stock de cada matéria-prima. Positivo = volta ao stock (gastou-se menos),
 * negativo = sai mais. Só as que mudam.
 */
export function materialDelta(before: MaterialLine[], after: MaterialLine[]): Map<string, number> {
    const d = new Map<string, number>();
    for (const l of cleanMaterials(before)) d.set(l.rawMaterialId, (d.get(l.rawMaterialId) || 0) + l.quantity);
    for (const l of cleanMaterials(after)) d.set(l.rawMaterialId, (d.get(l.rawMaterialId) || 0) - l.quantity);
    for (const [k, v] of [...d]) { if (Math.abs(v) < 1e-9) d.delete(k); else d.set(k, round(v)); }
    return d;
}

// ---------- matéria-prima nova, criada a partir da produção ----------
const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export type NewMaterialInput = { name: string; unit: string; stock: string };
export type NewMaterialCheck =
    | { kind: 'ok'; value: { name: string; unit: string; stock: number } }
    | { kind: 'existing'; id: string; name: string }
    | { kind: 'error'; error: string };

/**
 * Validar uma matéria-prima nova escrita na produção. Se já existe com esse nome (sem acentos nem maiúsculas), usa-se
 * a que existe — não se cria repetida. O stock é o que há agora (antes desta produção): a produção desconta dele.
 */
export function checkNewMaterial(i: NewMaterialInput, existing: { id: string; name: string }[]): NewMaterialCheck {
    const name = i.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return { kind: 'error', error: 'Escreva o nome da matéria-prima (ex.: Cimento, Areia, Saco).' };
    const same = existing.find((m) => normName(m.name) === normName(name));
    if (same) return { kind: 'existing', id: same.id, name: same.name };
    const raw = String(i.stock).replace(/\s/g, '').replace(',', '.');
    const stock = raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(stock) || stock < 0) return { kind: 'error', error: 'Quanto há em stock agora? (0 ou mais)' };
    return { kind: 'ok', value: { name: name.charAt(0).toUpperCase() + name.slice(1), unit: (i.unit || 'un').trim() || 'un', stock } };
}

export type WasteHint = { material: string; used: number; unit?: string; capacity: number; wastePercent: number };

/**
 * Abrir material a mais para poucas unidades: ex. 1 saco de cimento faz 75 blocos e vão fazer-se 80 → abre-se um
 * 2.º saco que dá para 150. Devolve o caso pior (o que mais desperdiça), quando passa de 30%, com a quantidade que
 * aproveita tudo. Só os ingredientes com rendimento (`yieldPerUnit`).
 */
export function wasteHint(recipe: RecipeLike | undefined, produced: number, raw: { id: string; unit?: string; name?: string }[] = []): WasteHint | null {
    if (!recipe || !(produced > 0)) return null;
    let worst: WasteHint | null = null;
    for (const g of recipe.ingredients) {
        const per = g.yieldPerUnit && g.yieldPerUnit > 0 ? g.yieldPerUnit : 0;
        if (!per) continue;
        const batches = Math.ceil(produced / per);
        const capacity = batches * per;
        const wastePercent = ((capacity - produced) / capacity) * 100;
        if (!worst || wastePercent > worst.wastePercent) {
            const r = raw.find((x) => x.id === g.rawMaterialId);
            worst = { material: r?.name || g.rawMaterialName, used: round(batches * g.quantity), unit: r?.unit, capacity, wastePercent };
        }
    }
    return worst && worst.wastePercent > 30 ? worst : null;
}
