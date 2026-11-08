// Níveis da subscrição (Básico, Pro, Business): o que cada um inclui e quanto custa. Puro, para ser testado.
//
// "Plano" em lib/plans.ts é o PERÍODO (mensal, trimestral, anual); aqui é o NÍVEL. O preço = nível × período.
// Empresas que já pagavam antes de haver níveis (sem `tier`) mantêm TUDO ao preço do Pro — ninguém perde nada.
// Durante o teste gratuito tudo está aberto, para a pessoa ver o que cada plano dá.
import type { PlanId } from '@/lib/plans';

export type TierId = 'basico' | 'pro' | 'business';
/** O que se pode pagar: um nível, ou manter o plano antigo (só quem já pagava antes dos níveis). */
export type PayTier = TierId | 'atual';

export type Feature =
    | 'tapSell'     // Vender por toque
    | 'variants'    // variações no catálogo
    | 'documents'   // proformas e documentos com a marca
    | 'orders'      // encomendas
    | 'reports'     // relatórios completos
    | 'production'  // produção e matérias-primas
    | 'locations';  // várias localizações

export type Tier = {
    id: TierId;
    label: string;
    monthly: number;
    /** para quem é */
    forWho: string;
    /** utilizadores incluídos (null = sem limite) */
    maxUsers: number | null;
    features: Feature[];
    /** o que mostrar no cartão do plano */
    highlights: string[];
};

// Vender por toque está em todos: é o que mais depressa convence uma loja pequena (abrir, tocar, vender)
const BASIC_FEATURES: Feature[] = ['tapSell'];
const PRO_FEATURES: Feature[] = [...BASIC_FEATURES, 'variants', 'documents', 'orders', 'reports'];

export const TIERS: Tier[] = [
    {
        id: 'basico', label: 'Básico', monthly: 300, forWho: 'Banca, loja pequena', maxUsers: 1, features: BASIC_FEATURES,
        highlights: ['1 utilizador', 'Vender por toque, leitor de códigos e voz', 'Stock, clientes e dívidas, despesas', 'Resumo do dia'],
    },
    {
        id: 'pro', label: 'Pro', monthly: 1000, forWho: 'Loja, ferragem, mercearia', maxUsers: 5, features: PRO_FEATURES,
        highlights: ['Até 5 utilizadores', 'Tudo do Básico', 'Catálogo com variações', 'Proformas e documentos com a sua marca', 'Encomendas e relatórios completos'],
    },
    {
        id: 'business', label: 'Business', monthly: 2000, forWho: 'Fábrica, armazém, várias lojas', maxUsers: null, features: [...PRO_FEATURES, 'production', 'locations'],
        highlights: ['Utilizadores sem limite', 'Tudo do Pro', 'Produção e matérias-primas', 'Várias localizações'],
    },
];

export const FEATURE_LABEL: Record<Feature, string> = {
    tapSell: 'Vender por toque',
    variants: 'Variações de produtos',
    documents: 'Proformas e documentos',
    orders: 'Encomendas',
    reports: 'Relatórios completos',
    production: 'Produção e matérias-primas',
    locations: 'Várias localizações',
};

export const tierById = (id: unknown): Tier | undefined => TIERS.find((t) => t.id === id);
export const isTierId = (id: unknown): id is TierId => !!tierById(id);

/** O nível mais barato que inclui a funcionalidade. */
export const tierFor = (f: Feature): Tier => TIERS.find((t) => t.features.includes(f))!;

/** Desconto por período (o mesmo de sempre: trimestral -10%, anual -15%). */
const PERIOD: Record<PlanId, { months: number; factor: number }> = {
    mensal: { months: 1, factor: 1 },
    trimestral: { months: 3, factor: 0.9 },
    anual: { months: 12, factor: 0.85 },
};

/** Preço a pagar por um nível num período. "atual" (plano antigo) = preço do Pro. */
export function tierAmount(tier: PayTier, plan: PlanId): number {
    const monthly = tier === 'atual' ? tierById('pro')!.monthly : tierById(tier)!.monthly;
    const p = PERIOD[plan];
    return Math.round(monthly * p.months * p.factor);
}

type CompanyLike = { tier?: unknown; status?: unknown } | null | undefined;

/** Ainda no plano antigo (sem nível escolhido) e não em teste: tudo incluído ao preço do Pro. */
export const onLegacyPlan = (c: CompanyLike) => !!c && !isTierId(c.tier) && c.status !== 'trial';

/** Tudo aberto: em teste, ou no plano antigo. */
const allOpen = (c: CompanyLike) => !c || c.status === 'trial' || !isTierId(c.tier);

/** A empresa tem esta funcionalidade no plano dela? */
export function companyHas(c: CompanyLike, f: Feature): boolean {
    if (allOpen(c)) return true;
    return tierById(c!.tier)!.features.includes(f);
}

/** Utilizadores permitidos (null = sem limite). */
export function companyMaxUsers(c: CompanyLike): number | null {
    if (allOpen(c)) return null;
    return tierById(c!.tier)!.maxUsers;
}

/** O nome do plano da empresa, para mostrar. */
export function companyTierLabel(c: CompanyLike): string {
    if (c?.status === 'trial') return 'Teste gratuito (tudo incluído)';
    const t = tierById(c?.tier);
    return t ? t.label : 'Completo (plano de lançamento)';
}

/** Nome de um nível a pagar ("atual" = o plano antigo). */
export const tierLabel = (t: PayTier) => (t === 'atual' ? 'Completo' : tierById(t)!.label);

/** Nível a cobrar: o pedido, se for válido para esta empresa; senão o atual dela. */
export function resolvePayTier(requested: unknown, c: CompanyLike): PayTier | null {
    if (isTierId(requested)) return requested;
    if (requested === 'atual') return onLegacyPlan(c) ? 'atual' : null;
    // pedidos sem nível (versão anterior da app): o que a empresa já tem
    if (requested == null || requested === '') return isTierId(c?.tier) ? (c!.tier as TierId) : onLegacyPlan(c) ? 'atual' : 'pro';
    return null;
}

/** Páginas que pertencem a uma funcionalidade (a mais específica primeiro). */
const ROUTES: [string, Feature][] = [
    ['/pos/catalogo', 'tapSell'],
    ['/production', 'production'],
    ['/raw-materials', 'production'],
    ['/orders', 'orders'],
    ['/documents', 'documents'],
    ['/reports', 'reports'],
];

export function featureForPath(pathname: string): Feature | null {
    const hit = ROUTES.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
    return hit ? hit[1] : null;
}
