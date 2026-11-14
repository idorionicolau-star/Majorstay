// Níveis da subscrição MajorStay Hospitality (Pro, Business, Enterprise)
import type { PlanId } from '@/lib/plans';

export type TierId = 'pro' | 'business' | 'enterprise' | 'basico';
/** O que se pode pagar: um nível, ou manter o plano antigo. */
export type PayTier = TierId | 'atual';

export type Feature =
    | 'rooms'       // Quartos e estadias em tempo real
    | 'tapSell'     // Vender por toque (Lounge & Bar)
    | 'bookings'    // Reservas antecipadas e WhatsApp
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
    /** quartos incluídos (null = sem limite) */
    maxRooms: number | null;
    /** utilizadores incluídos (null = sem limite) */
    maxUsers: number | null;
    features: Feature[];
    /** o que mostrar no cartão do plano */
    highlights: string[];
};

const PRO_FEATURES: Feature[] = ['rooms', 'tapSell', 'bookings', 'documents', 'reports'];
const BUSINESS_FEATURES: Feature[] = [...PRO_FEATURES, 'variants', 'orders', 'production'];
const ENTERPRISE_FEATURES: Feature[] = [...BUSINESS_FEATURES, 'locations'];

export const TIERS: Tier[] = [
    {
        id: 'pro',
        label: 'Pro',
        monthly: 1000,
        forWho: 'Guest Houses, Pensões e Alojamentos',
        maxRooms: 15,
        maxUsers: 3,
        features: PRO_FEATURES,
        highlights: [
            'Até 15 quartos e estadias em tempo real',
            'Visor QR Code e cartão de mesa para quartos',
            'Cobrança por hora e pernoita',
            'Lounge & Bar com comanda digital',
            'Serviços de alojamento sem limites',
            'Recibos e reservas por WhatsApp',
            '3 utilizadores incluídos',
        ],
    },
    {
        id: 'business',
        label: 'Business',
        monthly: 1500,
        forWho: 'Lodges, Motéis e Hotéis Médios',
        maxRooms: 30,
        maxUsers: 10,
        features: BUSINESS_FEATURES,
        highlights: [
            'De 16 até 30 quartos e reservas antecipadas',
            'Controlo de turnos de receção e auditoria',
            'Gestão de stock de Bar e Frigobar',
            'Serviços de alojamento sem limites',
            'Documentos e comanda com a sua marca',
            '10 utilizadores incluídos',
        ],
    },
    {
        id: 'enterprise',
        label: 'Enterprise',
        monthly: 5500,
        forWho: 'Hotéis de Grande Porte, Resorts e Redes',
        maxRooms: null,
        maxUsers: null,
        features: ENTERPRISE_FEATURES,
        highlights: [
            'Quartos ilimitados e multi-propriedades',
            'Tudo do Business + Várias localizações',
            'Serviços de alojamento sem limites',
            'Auditoria avançada e permissões de gerência',
            'Suporte prioritário dedicado 24/7',
            'Utilizadores ilimitados',
        ],
    },
];

export const FEATURE_LABEL: Record<Feature, string> = {
    rooms: 'Quadro de Quartos e Estadias',
    tapSell: 'Lounge & Bar (Venda Rápida)',
    bookings: 'Reservas Antecipadas & WhatsApp',
    variants: 'Variações de produtos e serviços',
    documents: 'Recibos, proformas e documentos',
    orders: 'Encomendas e fornecedores',
    reports: 'Relatórios completos de ocupação e receita',
    production: 'Produção e cozinha',
    locations: 'Várias localizações e propriedades',
};

export const tierById = (id: unknown): Tier | undefined => {
    if (id === 'basico') {
        return {
            id: 'basico',
            label: 'Básico',
            monthly: 1000,
            forWho: 'Alojamento Inicial',
            maxRooms: 15,
            maxUsers: 1,
            features: PRO_FEATURES,
            highlights: ['1 utilizador', 'Até 15 quartos', 'Visor QR Code para quartos', 'Quadro de Quartos e Bar', 'Cobrança por hora'],
        };
    }
    return TIERS.find((t) => t.id === id);
};

export const isTierId = (id: unknown): id is TierId => !!tierById(id);

/** O nível mais barato que inclui a funcionalidade. */
export const tierFor = (f: Feature): Tier => TIERS.find((t) => t.features.includes(f)) || TIERS[0];

/** Desconto por período (trimestral -10%, anual -15%). */
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

/** Quartos permitidos (null = sem limite). */
export function companyMaxRooms(c: CompanyLike): number | null {
    if (allOpen(c)) return null;
    return tierById(c?.tier)?.maxRooms ?? null;
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
