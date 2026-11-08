// Mudar o nome de um produto em todo o programa — lógica pura, sem Firebase nem React, para ser testada.
//
// O catálogo, o stock (em todas as localizações), as receitas e as encomendas em aberto ligam-se pelo NOME:
// muda-se em todos ao mesmo tempo. O histórico (vendas, movimentos, produções, encomendas entregues) não se
// reescreve — os movimentos são imutáveis e a factura mostra o nome com que se vendeu. Em vez disso, o produto
// guarda os nomes antigos (`formerNames`) e, ao ler, o histórico passa a aparecer com o nome novo.
import { nameKey } from '@/lib/catalog-view';

type Named = { id?: string; name: string; variantGroup?: string; formerNames?: string[]; deletedAt?: string | null };
type HasProductName = { id: string; productName: string; status?: string; deletedAt?: string | null };

export type RenamePair = { from: string; to: string };

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * Os pares antigo → novo. Um produto simples dá um par; mudar o nome de uma família de variações muda
 * o nome base de todas ("Pavê - Vermelho" → "Pavê Borbulha - Vermelho").
 */
export function renamePairs(product: Named, newName: string, all: Named[], family = false): RenamePair[] {
    const to = clean(newName);
    if (!to) return [];
    if (family && product.variantGroup) {
        const base = clean(product.variantGroup);
        const k = nameKey(base);
        const seen = new Set<string>();
        const out: RenamePair[] = [];
        for (const p of all) {
            if (p.deletedAt || !p.variantGroup || nameKey(p.variantGroup) !== k || seen.has(nameKey(p.name))) continue;
            seen.add(nameKey(p.name));
            // "Base - Vermelho": troca só a base; se o nome não começar pela base, junta-a à frente
            const rest = nameKey(p.name).startsWith(k) ? p.name.slice(base.length) : ` - ${p.name}`;
            out.push({ from: p.name, to: `${to}${rest}` });
        }
        return out.filter((x) => x.from !== x.to);
    }
    return product.name === to ? [] : [{ from: product.name, to }];
}

/** Um nome novo que já pertence a OUTRO produto (no catálogo ou no stock)? Devolve-o. */
export function renameClash(pairs: RenamePair[], all: Named[]): string | null {
    const moving = new Set(pairs.map((p) => nameKey(p.from)));
    const taken = new Set(all.filter((p) => !p.deletedAt).map((p) => nameKey(p.name)).filter((k) => !moving.has(k)));
    const seen = new Set<string>();
    for (const p of pairs) {
        const k = nameKey(p.to);
        if (taken.has(k) || seen.has(k)) return p.to;
        seen.add(k);
    }
    return null;
}

type RenameData = { name: string; formerNames: string[]; variantGroup?: string; variantValues?: Record<string, string> };

export type RenamePlan = {
    /** catálogo e stock: nome novo, nomes antigos e (numa família) a base nova */
    catalog: { id: string; data: RenameData }[];
    products: { id: string; data: RenameData }[];
    recipes: { id: string; productName: string }[];
    orders: { id: string; productName: string }[];
};

/** O que gravar: tudo o que tem um dos nomes antigos passa a ter o novo. */
export function planRename(
    pairs: RenamePair[],
    data: { catalog: Named[]; products: Named[]; recipes: HasProductName[]; orders: HasProductName[] },
    newGroup?: string,
    /** campos a gravar junto (ex.: um produto que passa a ser variação: { variantGroup, variantValues }) */
    extra?: { variantGroup?: string; variantValues?: Record<string, string> },
): RenamePlan {
    const to = new Map(pairs.map((p) => [nameKey(p.from), p]));
    const named = (rows: Named[]) =>
        rows.flatMap((r) => {
            const p = to.get(nameKey(r.name));
            if (!r.id || !p) return [];
            const former = [...(r.formerNames || []), r.name].filter((n, i, a) => nameKey(n) !== nameKey(p.to) && a.findIndex((x) => nameKey(x) === nameKey(n)) === i);
            return [{ id: r.id, data: { name: p.to, formerNames: former, ...(newGroup && r.variantGroup ? { variantGroup: clean(newGroup) } : {}), ...(extra || {}) } }];
        });
    const linked = (rows: HasProductName[], open?: (r: HasProductName) => boolean) =>
        rows.flatMap((r) => {
            const p = to.get(nameKey(r.productName || ''));
            return p && !r.deletedAt && (!open || open(r)) ? [{ id: r.id, productName: p.to }] : [];
        });
    return {
        catalog: named(data.catalog),
        products: named(data.products),
        recipes: linked(data.recipes),
        // as entregues são história: aparecem com o nome novo ao ler (ver applyAliases)
        orders: linked(data.orders, (o) => o.status !== 'Entregue'),
    };
}

/** nome antigo (chave) → nome actual. Um nome antigo que voltou a ser usado por outro produto não conta. */
export function aliasMap(...lists: (Named[] | null | undefined)[]): Map<string, string> {
    const current = new Set<string>();
    for (const l of lists) for (const p of l || []) if (!p.deletedAt) current.add(nameKey(p.name));
    const out = new Map<string, string>();
    for (const l of lists) {
        for (const p of l || []) {
            if (p.deletedAt) continue;
            for (const f of p.formerNames || []) {
                const k = nameKey(f);
                if (k && !current.has(k) && !out.has(k)) out.set(k, p.name);
            }
        }
    }
    return out;
}

/** O histórico com o nome actual (só copia as linhas que mudam; sem nomes antigos devolve a mesma lista). */
export function applyAliases<T extends { productName?: string }>(rows: T[] | null | undefined, aliases: Map<string, string>): T[] | null | undefined {
    if (!rows || aliases.size === 0) return rows;
    let changed = false;
    const out = rows.map((r) => {
        const now = r.productName ? aliases.get(nameKey(r.productName)) : undefined;
        if (!now || now === r.productName) return r;
        changed = true;
        return { ...r, productName: now };
    });
    return changed ? out : rows;
}

/**
 * Um produto solto, com stock ("Pavê Borbulha"), passa a ser uma variação que já existe no catálogo
 * ("Pavê Borbulha - Preto", ainda sem stock): o stock, as receitas e as encomendas em aberto passam para a
 * variação; a entrada solta do catálogo vai para a lixeira; o nome antigo fica guardado na variação
 * (o histórico aparece com o nome novo).
 */
export function planMergeIntoVariant(
    fromName: string,
    target: Named & { id?: string; variantValues?: Record<string, string> },
    data: { catalog: Named[]; products: (Named & { location?: string })[]; recipes: HasProductName[]; orders: HasProductName[] },
): { plan: RenamePlan; trash: string[]; clash: string | null } {
    const from = nameKey(fromName);
    const to = nameKey(target.name);
    // a variação já tem stock numa localização onde o produto solto também tem: juntar seria somar às cegas
    const here = new Set(data.products.filter((p) => !p.deletedAt && nameKey(p.name) === to).map((p) => p.location || ''));
    const clash = data.products.some((p) => !p.deletedAt && nameKey(p.name) === from && here.has(p.location || '')) ? target.name : null;
    const plan = planRename([{ from: fromName, to: target.name }], { catalog: [], products: data.products, recipes: data.recipes, orders: data.orders }, undefined, {
        variantGroup: target.variantGroup,
        variantValues: target.variantValues || {},
    });
    if (target.id) {
        const former = [...(target.formerNames || []), fromName].filter((n, i, a) => nameKey(n) !== to && a.findIndex((x) => nameKey(x) === nameKey(n)) === i);
        plan.catalog = [{ id: target.id, data: { name: target.name, formerNames: former } }];
    }
    const trash = data.catalog.filter((c) => c.id && !c.deletedAt && nameKey(c.name) === from).map((c) => c.id!);
    return { plan, trash, clash };
}
