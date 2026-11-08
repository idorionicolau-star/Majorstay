// Pontos (sítios): uma empresa com várias lojas pela província. Cada localização pode pertencer a um ponto
// (ex.: "Matola" com "Fábrica" e "Mostruário"); um funcionário com ponto só vê e vende o stock desse ponto.
// As localizações continuam a ser o que sempre foram: o ponto só agrupa e limita o que cada um vê. Puro, para testes.
import type { Location } from '@/lib/types';

type LocLike = Pick<Location, 'id' | 'name'> & { site?: string };
type UserLike = { role?: string; site?: string } | null | undefined;
type CompanyLike = { isMultiLocation?: boolean; locations?: LocLike[] } | null | undefined;

export const siteOf = (l: { site?: string }) => (l.site || '').trim();

/** Os pontos da empresa, por ordem alfabética. */
export function sitesOf(locations: LocLike[]): string[] {
    return Array.from(new Set(locations.map(siteOf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt'));
}

/** Localizações por ponto e depois por nome (as sem ponto no fim). */
export function sortBySite<T extends LocLike>(locations: T[]): T[] {
    return [...locations].sort((a, b) => {
        const sa = siteOf(a), sb = siteOf(b);
        if (sa !== sb) return !sa ? 1 : !sb ? -1 : sa.localeCompare(sb, 'pt');
        return a.name.localeCompare(b.name, 'pt');
    });
}

/** "Matola · Fábrica" (ou só o nome, sem ponto). */
export const locationLabel = (l: LocLike) => (siteOf(l) ? `${siteOf(l)} · ${l.name}` : l.name);

/**
 * O que este utilizador pode ver: os ids das localizações do ponto dele, ou null (vê tudo).
 * Só os funcionários com ponto, numa empresa com várias localizações, ficam limitados — Admin e Dono veem tudo.
 */
export function scopeFor(user: UserLike, company: CompanyLike): Set<string> | null {
    const site = (user?.site || '').trim();
    if (!site || user?.role !== 'Employee' || !company?.isMultiLocation) return null;
    return new Set((company.locations || []).filter((l) => siteOf(l) === site).map((l) => l.id));
}

/**
 * Este registo (com este local) está no âmbito? Sem local ("" ou "Principal") conta como a primeira localização
 * da empresa, como no resto da app.
 */
export function inScope(scope: Set<string> | null, location: string | null | undefined, firstLocationId?: string): boolean {
    if (!scope) return true;
    const id = !location || location === 'Principal' ? firstLocationId : location;
    return !!id && scope.has(id);
}

export type SiteTotals = { site: string; stockValue: number; monthSales: number };

/**
 * Totais por ponto (para quem gere): valor do stock e vendas do mês. As localizações sem ponto ficam em "Sem ponto".
 * `income` é o que a venda conta (o mesmo do resto do Painel).
 */
export function siteTotals(
    locations: LocLike[],
    products: { location?: string; stock: number; price: number }[],
    monthSales: { location?: string }[],
    income: (s: any) => number,
): SiteTotals[] {
    const first = locations[0]?.id;
    const siteById = new Map(locations.map((l) => [l.id, siteOf(l) || 'Sem ponto']));
    const of = (loc?: string) => siteById.get(!loc || loc === 'Principal' ? first || '' : loc) || 'Sem ponto';
    const out = new Map<string, SiteTotals>();
    const get = (site: string) => out.get(site) || out.set(site, { site, stockValue: 0, monthSales: 0 }).get(site)!;
    for (const l of locations) get(siteOf(l) || 'Sem ponto');
    for (const p of products) get(of(p.location)).stockValue += (Number(p.stock) || 0) * (Number(p.price) || 0);
    for (const s of monthSales) get(of(s.location)).monthSales += income(s);
    return [...out.values()].sort((a, b) => (a.site === 'Sem ponto' ? 1 : b.site === 'Sem ponto' ? -1 : a.site.localeCompare(b.site, 'pt')));
}

/** Filtro de localização das listas: "all", um local (id) ou um ponto inteiro ("site:Matola"). */
export const siteFilter = (site: string) => `site:${site}`;
export function matchesLocationFilter(filter: string, location: string | null | undefined, locations: LocLike[]): boolean {
    if (!filter || filter === 'all') return true;
    const id = !location || location === 'Principal' ? locations[0]?.id : location;
    if (filter.startsWith('site:')) {
        const l = locations.find((x) => x.id === id);
        return !!l && siteOf(l) === filter.slice(5);
    }
    return id === filter || location === filter;
}
