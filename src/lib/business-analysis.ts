/**
 * Offline business analysis engine — one source of truth for Diagnóstico,
 * the dashboard insights and the Major Assistant. Pure functions, no network.
 */
import { reservedDrifts } from "@/lib/reserved-stock";
import type { Customer, Order, Product, Production, Sale, StockMovement } from "@/lib/types";
import { daysAgo, formatCurrency, normalizeString, plural } from "@/lib/utils";
import { links } from "@/lib/deep-links";

export type Severity = "critical" | "warning" | "info" | "good";

export type Alert = {
    id: string;
    severity: Severity;
    title: string;
    detail: string;
    action?: { label: string; href: string };
    items?: string[];
    /** link directo de cada item (mesma ordem de `items`) */
    itemLinks?: string[];
};

export type DataTask = {
    id: string;
    label: string;
    detail: string;
    done: boolean;
    weight: number;
    action?: { label: string; href: string };
};

/** saleDays: em quantos dias diferentes vendeu nos últimos 30 (o padrão de procura; ver isLearning) */
export type ProductRisk = { name: string; location?: string; unit: string; available: number; daysLeft: number; soldPerDay: number; saleDays: number };

/** Abaixo disto (dias com vendas nos últimos 30) não há padrão: a app ainda está "a aprender" e não sugere quantidades. */
export const MIN_SALE_DAYS = 3;
export const isLearning = (r: Pick<ProductRisk, "saleDays">) => r.saleDays < MIN_SALE_DAYS;

/** Ritmo de venda legível: "~3 un/dia", "~2 un/semana" ou "~1 un/mês" (em vez de "~0,2 un/dia"). */
export function rateLabel(perDay: number, unit = "un"): string {
    const f = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("pt-PT");
    if (perDay >= 1) return `~${f(perDay)} ${unit}/dia`;
    if (perDay * 7 >= 1) return `~${f(perDay * 7)} ${unit}/semana`;
    return `~${f(Math.max(perDay * 30, 0))} ${unit}/mês`;
}

/** Dias de vendas que uma produção (ou reposição) sugerida deve cobrir. */
export const PLAN_COVER_DAYS = 30;

/** Quanto produzir para cobrir PLAN_COVER_DAYS de vendas ao ritmo do último mês, descontando o que ainda há. */
export function suggestedQuantity(r: Pick<ProductRisk, "available" | "soldPerDay">, coverDays = PLAN_COVER_DAYS): number {
    const need = r.soldPerDay * coverDays - Math.max(0, r.available);
    return need > 0 ? Math.ceil(need) : 0;
}

export type Analysis = {
    now: Date;
    sales: {
        today: number; todayTickets: number;
        last7: number; last30: number; prev30: number; growth30: number | null;
        month: number; monthTickets: number; lastMonth: number; projectedMonth: number;
        avgTicket30: number; margin30: number | null; marginPct30: number | null;
        lastSaleDate: Date | null; daysSinceLastSale: number | null;
        topProducts30: { name: string; qty: number; revenue: number; unit: string }[];
        topSellers30: { name: string; revenue: number; tickets: number }[];
        receivables: number; receivablesList: { client: string; amount: number; guide: string; days: number }[];
    };
    stock: {
        productCount: number; valueAtPrice: number; valueAtCost: number | null;
        outOfStock: Product[]; critical: Product[]; low: Product[]; negative: Product[];
        reservedOverStock: Product[];
        /** reservado sem nenhuma venda paga por levantar nem encomenda por trás (reserva presa) */
        reservedDrift: { product: Product; drift: number }[];
        runout: ProductRisk[];
        /** days: a janela usada (90, ou menos se a app tem vendas há menos tempo) */
        dead: { count: number; value: number; pctOfValue: number; examples: string[]; days: number };
        healthScore: number;
        pendingPickups: { sale: Sale; days: number }[];
        lastCountDate: Date | null; daysSinceCount: number | null;
    };
    production: { lastDate: Date | null; daysSince: number | null; last30Qty: number; pendingTransfers: number };
    orders: { open: Order[]; overdue: Order[]; readyForPickup: Order[] };
    customers: { total: number; missingContact: number; inactive: Customer[]; anonymousSalesPct: number | null };
    quality: {
        score: number;
        tasks: DataTask[];
        duplicates: string[];
        zeroPrice: Product[];
        missingCost: Product[];
        uncategorized: Product[];
        fractionalUnits: Product[];
    };
    alerts: Alert[];
    headline: string[];
};

const DAY = 86_400_000;
const days = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY);
const safeDate = (v: unknown): Date | null => {
    if (!v) return null;
    const anyV = v as { toDate?: () => Date };
    const d = typeof anyV.toDate === "function" ? anyV.toDate() : new Date(v as string);
    return isNaN(d.getTime()) ? null : d;
};
const revenueOf = (s: Sale) => Number(s.amountPaid ?? s.totalValue ?? 0) || 0;
const available = (p: Product) => (p.stock || 0) - (p.reservedStock || 0);
/** "acaba hoje", "acaba amanhã", "~5 dias" — em vez de "~0 dias". */
export const runoutLabel = (daysLeft: number) => (daysLeft <= 0 ? "acaba hoje" : daysLeft === 1 ? "acaba amanhã" : `~${daysLeft} dias`);
const key = (name: string) => normalizeString((name || "").trim());
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function analyzeBusiness(input: {
    products?: Product[];
    sales?: Sale[];
    orders?: Order[];
    productions?: Production[];
    customers?: Customer[];
    stockMovements?: StockMovement[];
    /** 'reseller' = comércio (não fabrica, não tem encomendas): o diagnóstico não fala de produção. */
    businessType?: 'manufacturer' | 'reseller';
    /** vários locais de stock: as reservas contam por local */
    multiLocation?: boolean;
    /** prazo da contagem (Ajustes → Empresa; por defeito 30 dias) */
    countEveryDays?: number;
    now?: Date;
}): Analysis {
    const reseller = input.businessType === 'reseller';
    const now = input.now ?? new Date();
    const products = (input.products || []).filter((p) => !p.deletedAt);
    const allSales = (input.sales || []).filter((s) => !s.deletedAt);
    const realSales = allSales.filter((s) => s.documentType !== "Factura Proforma" && s.documentType !== "Cotação");
    const orders = reseller ? [] : (input.orders || []).filter((o) => !o.deletedAt);
    const productions = reseller ? [] : (input.productions || []).filter((p) => !p.deletedAt);
    const customers = input.customers || [];
    const movements = input.stockMovements || [];

    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ago = (d: number) => new Date(now.getTime() - d * DAY);

    const dated = realSales.map((s) => ({ s, d: safeDate(s.date) })).filter((x): x is { s: Sale; d: Date } => !!x.d);
    const inRange = (from: Date, to: Date = now) => dated.filter((x) => x.d >= from && x.d <= to).map((x) => x.s);
    const sum = (list: Sale[]) => list.reduce((t, s) => t + revenueOf(s), 0);
    const tickets = (list: Sale[]) => new Set(list.map((s) => s.guideNumber || s.id)).size;

    const todayS = inRange(startToday);
    const s7 = inRange(ago(7));
    const s30 = inRange(ago(30));
    const sPrev30 = dated.filter((x) => x.d >= ago(60) && x.d < ago(30)).map((x) => x.s);
    const monthS = inRange(startMonth);
    const lastMonthS = dated.filter((x) => x.d >= startLastMonth && x.d < startMonth).map((x) => x.s);
    const last30 = sum(s30);
    const prev30 = sum(sPrev30);
    const monthRev = sum(monthS);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const withCost = s30.filter((s) => (s.unitCost || 0) > 0);
    const margin30 = withCost.length ? withCost.reduce((t, s) => t + ((s.unitPrice || 0) - (s.unitCost || 0)) * (s.quantity || 0), 0) : null;
    const marginBase = withCost.reduce((t, s) => t + (s.unitPrice || 0) * (s.quantity || 0), 0);

    const lastSaleDate = dated.length ? new Date(Math.max(...dated.map((x) => x.d.getTime()))) : null;

    // velocity by product name (+location when present)
    const sold30 = new Map<string, number>();
    s30.forEach((s) => sold30.set(key(s.productName), (sold30.get(key(s.productName)) || 0) + (s.quantity || 0)));
    const soldEver90 = new Set(inRange(ago(90)).map((s) => key(s.productName)));
    // em quantos dias (de Maputo) diferentes cada produto vendeu nos últimos 30
    const saleDays30 = new Map<string, Set<string>>();
    dated.filter((x) => x.d >= ago(30) && x.d <= now).forEach((x) => {
        const k = key(x.s.productName);
        const dayMz = new Date(x.d.getTime() + 2 * 3600_000).toISOString().slice(0, 10);
        saleDays30.set(k, (saleDays30.get(k) || new Set()).add(dayMz));
    });

    const topMap = new Map<string, { name: string; qty: number; revenue: number; unit: string }>();
    s30.forEach((s) => {
        const k = key(s.productName);
        const e = topMap.get(k) || { name: s.productName, qty: 0, revenue: 0, unit: s.unit || "un" };
        e.qty += s.quantity || 0;
        e.revenue += revenueOf(s);
        topMap.set(k, e);
    });
    const sellerMap = new Map<string, { name: string; revenue: number; guides: Set<string> }>();
    s30.forEach((s) => {
        const n = s.soldBy || "—";
        const e = sellerMap.get(n) || { name: n, revenue: 0, guides: new Set<string>() };
        e.revenue += revenueOf(s);
        e.guides.add(s.guideNumber || s.id);
        sellerMap.set(n, e);
    });

    const receivablesList = realSales
        .filter((s) => (s.totalValue || 0) - (s.amountPaid ?? s.totalValue ?? 0) > 0.5)
        .map((s) => ({
            client: s.clientName || "Cliente sem nome",
            amount: (s.totalValue || 0) - (s.amountPaid || 0),
            guide: s.guideNumber,
            days: safeDate(s.date) ? days(now, safeDate(s.date)!) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

    // ---------- stock ----------
    const outOfStock = products.filter((p) => available(p) <= 0);
    const critical = products.filter((p) => available(p) > 0 && available(p) <= (p.criticalStockThreshold || 0));
    const low = products.filter((p) => available(p) > (p.criticalStockThreshold || 0) && available(p) <= (p.lowStockThreshold || 0));
    const negative = products.filter((p) => (p.stock || 0) < 0);
    const reservedOverStock = products.filter((p) => (p.reservedStock || 0) > (p.stock || 0) && (p.reservedStock || 0) > 0);
    const reservedDrift = reservedDrifts(products.filter((p) => (p.reservedStock || 0) > 0), input.sales || [], input.orders || [], !!input.multiLocation)
        .filter((d) => d.drift > 0)
        .map((d) => ({ product: d.product as Product, drift: d.drift }));
    const valueAtPrice = products.reduce((t, p) => t + Math.max(0, p.stock || 0) * (p.price || 0), 0);
    const costKnown = products.filter((p) => (p.cost || 0) > 0);
    const valueAtCost = costKnown.length ? costKnown.reduce((t, p) => t + Math.max(0, p.stock || 0) * (p.cost || 0), 0) : null;

    const runout: ProductRisk[] = products
        .map((p) => {
            const perDay = (sold30.get(key(p.name)) || 0) / 30;
            const av = available(p);
            return { name: p.name, location: p.location, unit: p.unit || "un", available: av, soldPerDay: perDay, daysLeft: perDay > 0 ? Math.floor(Math.max(0, av) / perDay) : Infinity, saleDays: saleDays30.get(key(p.name))?.size || 0 };
        })
        .filter((r) => r.soldPerDay > 0 && r.daysLeft <= 14)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    // "sem vendas há N dias" só se a app tem vendas registadas desde há N dias (antes disso não sabe o que se vendeu)
    const firstSaleDate = dated.length ? new Date(Math.min(...dated.map((x) => x.d.getTime()))) : null;
    const deadWindow = firstSaleDate ? Math.min(90, days(now, firstSaleDate)) : 0;
    const deadList = deadWindow >= 30 ? products.filter((p) => available(p) > 0 && !soldEver90.has(key(p.name))) : [];
    const deadValue = deadList.reduce((t, p) => t + available(p) * (p.price || 0), 0);

    const inStock = products.filter((p) => available(p) > 0);
    const healthy = inStock.filter((p) => available(p) > (p.lowStockThreshold || 0)).length;
    const healthScore = products.length ? Math.round((healthy / products.length) * 100) : 0;

    const pendingPickups = realSales
        .filter((s) => s.status === "Pago" && !s.orderId && s.documentType !== "Encomenda")
        .map((s) => ({ sale: s, days: safeDate(s.date) ? days(now, safeDate(s.date)!) : 0 }))
        .sort((a, b) => b.days - a.days);

    const auditDates = movements.filter((m) => m.isAudit).map((m) => safeDate(m.timestamp)).filter((d): d is Date => !!d);
    const lastCountDate = auditDates.length ? new Date(Math.max(...auditDates.map((d) => d.getTime()))) : null;

    // ---------- production ----------
    const prodDates = productions.map((p) => safeDate(p.date)).filter((d): d is Date => !!d);
    const lastProd = prodDates.length ? new Date(Math.max(...prodDates.map((d) => d.getTime()))) : null;
    const last30Qty = productions.filter((p) => (safeDate(p.date) || new Date(0)) >= ago(30)).reduce((t, p) => t + (p.quantity || 0), 0);

    // ---------- orders ----------
    const open = orders.filter((o) => o.status !== "Entregue");
    const overdue = open.filter((o) => { const d = safeDate(o.deliveryDate); return d && d < startToday; });
    const readyForPickup = open.filter((o) => o.status === "Concluída");

    // ---------- customers ----------
    const missingContact = customers.filter((c) => !c.phone && !c.email).length;
    const inactive = customers
        .filter((c) => (c.totalPurchases || 0) > 0 && safeDate(c.lastVisit) && days(now, safeDate(c.lastVisit)!) > 45)
        .sort((a, b) => (b.totalPurchases || 0) - (a.totalPurchases || 0));
    const anonymousSalesPct = s30.length ? Math.round((s30.filter((s) => !s.customerId && !s.clientName).length / s30.length) * 100) : null;

    // ---------- data quality ----------
    const byNameLoc = new Map<string, number>();
    (input.products || []).filter((p) => !p.deletedAt).forEach((p) => {
        const k = `${key(p.name)}|${p.location || ""}`;
        byNameLoc.set(k, (byNameLoc.get(k) || 0) + 1);
    });
    const nameGroups = new Map<string, Set<string>>();
    products.forEach((p) => {
        const k = `${key(p.name)}|${p.location || ""}`;
        if (!nameGroups.has(k)) nameGroups.set(k, new Set());
        nameGroups.get(k)!.add(p.name);
    });
    // same product typed twice (different ids after merge are summed; here: near-identical names)
    const seen = new Map<string, string>();
    const seenName = new Map<string, string>();
    const duplicateNames = new Set<string>();
    const duplicates: string[] = [];
    products.forEach((p) => {
        const k = `${key(p.name).replace(/[^a-z0-9]/g, "")}|${p.location || ""}`;
        if (seen.has(k) && seen.get(k) !== p.instanceId) { duplicates.push(p.name); duplicateNames.add(p.name); duplicateNames.add(seenName.get(k) || p.name); }
        else { seen.set(k, p.instanceId); seenName.set(k, p.name); }
    });
    const zeroPrice = products.filter((p) => !(p.price > 0));
    const missingCost = products.filter((p) => !((p.cost || 0) > 0));
    const uncategorized = products.filter((p) => !p.category || ["geral", "sem categoria"].includes(key(p.category)));
    const fractionalUnits = products.filter((p) => (p.unit || "un") === "un" && !Number.isInteger(p.stock || 0));

    const daysSinceLastSale = lastSaleDate ? days(now, lastSaleDate) : null;
    const daysSinceProd = lastProd ? days(now, lastProd) : null;
    const daysSinceCount = lastCountDate ? days(now, lastCountDate) : null;
    const pct = (n: number) => (products.length ? n / products.length : 0);

    const tasks: DataTask[] = [
        {
            id: "sales", weight: 30,
            label: "Vendas registadas em dia",
            done: daysSinceLastSale !== null && daysSinceLastSale <= 3,
            detail: daysSinceLastSale === null ? "Ainda não há nenhuma venda registada." : daysSinceLastSale <= 3 ? "Última venda registada recentemente." : `A última venda registada foi há ${daysSinceLastSale} dias. Se vendeu desde então, o stock e os relatórios estão errados.`,
            action: { label: "Registar venda", href: "/pos" },
        },
        {
            id: "count", weight: 20,
            label: "Stock contado nos últimos 30 dias",
            done: daysSinceCount !== null && daysSinceCount <= 30,
            detail: daysSinceCount === null ? "Nunca foi feita uma contagem pelo sistema. Os números do stock não foram confirmados." : `Última contagem ${daysAgo(daysSinceCount)}.`,
            action: { label: "Fazer contagem", href: "/inventory/quick?modo=contagem" },
        },
        {
            id: "cost", weight: 15,
            label: "Custos dos produtos preenchidos",
            done: pct(missingCost.length) <= 0.1,
            detail: missingCost.length ? `${plural(missingCost.length, "produto não tem", "produtos não têm")} custo — sem isso o lucro real não pode ser calculado.` : "Todos os produtos têm custo.",
            action: { label: "Completar custos", href: links.inventoryProblem("sem-custo") },
        },
        {
            id: "price", weight: 10,
            label: "Todos os produtos com preço",
            done: zeroPrice.length === 0,
            detail: zeroPrice.length ? `${plural(zeroPrice.length, "produto está", "produtos estão")} a 0 MT — podem ser vendidos de graça por engano.` : "Todos têm preço de venda.",
            action: { label: "Corrigir preços", href: links.inventoryProblem("sem-preco") },
        },
        {
            id: "clean", weight: 10,
            label: "Catálogo arrumado (sem duplicados nem categoria 'Geral')",
            done: duplicates.length === 0 && pct(uncategorized.length) <= 0.1,
            detail: [duplicates.length ? `${plural(duplicates.length, "produto parece duplicado", "produtos parecem duplicados")}` : "", uncategorized.length ? `${plural(uncategorized.length, "produto", "produtos")} sem categoria própria` : ""].filter(Boolean).join(" · ") || "Catálogo limpo.",
            action: { label: "Rever catálogo", href: duplicateNames.size ? links.products([...duplicateNames], "Possíveis duplicados") : links.inventoryProblem("sem-categoria") },
        },
    ];
    // Só quem fabrica regista produção (um comércio de revenda não).
    if (!reseller) {
        tasks.splice(2, 0, {
            id: "production", weight: 15,
            label: "Produção registada",
            done: daysSinceProd !== null && daysSinceProd <= 14,
            detail: daysSinceProd === null ? "Sem produção registada." : daysSinceProd <= 14 ? `Última produção ${daysAgo(daysSinceProd)}.` : `A última produção registada foi há ${daysSinceProd} dias. O que foi fabricado depois não está no stock.`,
            action: { label: "Registar produção", href: "/production" },
        });
    }
    const qualityScore = Math.round(tasks.reduce((t, k) => t + (k.done ? k.weight : 0), 0) / tasks.reduce((t, k) => t + k.weight, 0) * 100);

    // ---------- alerts (most important first) ----------
    const alerts: Alert[] = [];
    if (daysSinceLastSale === null || daysSinceLastSale > 7) {
        alerts.push({
            id: "no-sales", severity: "critical",
            title: daysSinceLastSale === null ? "Nenhuma venda registada" : `${daysSinceLastSale} dias sem vendas registadas`,
            detail: "Cada venda que não é registada deixa o stock mais alto do que o real, esconde o lucro e engana todas as análises. Registe as vendas do dia, mesmo as pequenas.",
            action: { label: "Registar venda agora", href: "/pos" },
        });
    }
    if (negative.length) alerts.push({ id: "negative", severity: "critical", title: `${plural(negative.length, "produto", "produtos")} com stock negativo`, detail: reseller ? "Saiu mais do que entrou — falta registar a entrada (compra) desse produto." : "Saiu mais do que entrou — falta registar entradas ou produção.", items: negative.slice(0, 5).map((p) => `${p.name}: ${fmtQty(p.stock)} ${p.unit || "un"}`), itemLinks: negative.slice(0, 5).map((p) => links.product(p.name, p.location)), action: { label: "Ver produtos com stock negativo", href: links.inventoryProblem("negativo") } });
    if (overdue.length) alerts.push({ id: "overdue", severity: "critical", title: `${plural(overdue.length, "encomenda atrasada", "encomendas atrasadas")}`, detail: "Passou a data de entrega combinada com o cliente.", items: overdue.slice(0, 5).map((o) => `${o.productName} — ${o.clientName || "cliente"}`), itemLinks: overdue.slice(0, 5).map((o) => links.order(o.id)), action: { label: "Ver encomendas atrasadas", href: overdue.length === 1 ? links.order(overdue[0].id) : "/orders" } });
    // os já esgotados têm o seu alerta ("produtos esgotados"): aqui só os que ainda têm stock
    // e só com padrão de vendas (uma venda isolada não é procura)
    const runoutSoon = runout.filter((r) => r.available > 0 && !isLearning(r));
    if (runoutSoon.length) alerts.push({ id: "runout", severity: "warning", title: `${plural(runoutSoon.length, "produto vai", "produtos vão")} esgotar em ≤ 14 dias`, detail: "Ao ritmo de venda do último mês.", items: runoutSoon.slice(0, 5).map((r) => `${r.name}: ${runoutLabel(r.daysLeft)} (${fmtQty(r.available)} ${r.unit})`), itemLinks: runoutSoon.slice(0, 5).map((r) => links.product(r.name, r.location)), action: reseller ? { label: "Repor stock", href: "/inventory/quick?modo=entrada" } : { label: "Planear produção", href: links.productionPlan() } });
    if (outOfStock.length) alerts.push({ id: "out", severity: "warning", title: `${plural(outOfStock.length, "produto esgotado", "produtos esgotados")}`, detail: reseller ? "Não podem ser vendidos até haver nova entrada de stock." : "Não podem ser vendidos até haver entrada ou produção.", items: outOfStock.slice(0, 5).map((p) => p.name), itemLinks: outOfStock.slice(0, 5).map((p) => links.product(p.name, p.location)), action: { label: "Ver produtos esgotados", href: links.inventoryProblem("esgotado") } });
    if (pendingPickups.some((p) => p.days > 7)) {
        const stale = pendingPickups.filter((p) => p.days > 7);
        alerts.push({ id: "pickups", severity: "warning", title: `${plural(stale.length, "venda paga", "vendas pagas")} por levantar há mais de 7 dias`, detail: "O material está reservado e não pode ser vendido a outros. Confirme o levantamento ou contacte o cliente.", items: stale.slice(0, 5).map((p) => `${p.sale.productName} — ${p.sale.clientName || "cliente"} (${p.days} dias)`), itemLinks: stale.slice(0, 5).map((p) => links.sale(p.sale.guideNumber || p.sale.productName)), action: { label: "Ver vendas por levantar", href: links.salesByStatus("Pago") } });
    }
    if (reservedDrift.length) alerts.push({ id: "reserved-orphan", severity: "warning", title: `${plural(reservedDrift.length, "produto tem", "produtos têm")} reserva sem venda nem encomenda por trás`, detail: "Fica reservado mas nada o justifica, por isso essa quantidade não pode ser vendida. No Inventário, toque em \"N reservados\" do produto para ver e libertar.", items: reservedDrift.slice(0, 5).map((d) => `${d.product.name}: ${fmtQty(d.drift)} reservado${d.drift === 1 ? "" : "s"} sem origem`), itemLinks: reservedDrift.slice(0, 5).map((d) => links.product(d.product.name, d.product.location)), action: { label: "Abrir Inventário", href: "/inventory" } });
    if (reservedOverStock.some((p) => !reservedDrift.some((d) => d.product.name === p.name)) ) alerts.push({ id: "reserved", severity: "warning", title: `${plural(reservedOverStock.length, "produto tem", "produtos têm")} mais reservado do que em stock`, detail: "Normalmente são reservas antigas presas. Em Ajustes → \"Recalcular stock reservado\" corrige.", items: reservedOverStock.slice(0, 5).map((p) => `${p.name}: stock ${fmtQty(p.stock)}, reservado ${fmtQty(p.reservedStock)}`), itemLinks: reservedOverStock.slice(0, 5).map((p) => links.product(p.name, p.location)), action: { label: "Abrir Ajustes", href: "/settings" } });
    if (receivablesList.length) {
        const total = receivablesList.reduce((t, r) => t + r.amount, 0);
        alerts.push({ id: "debts", severity: "warning", title: `${formatCurrency(total)} por receber`, detail: `${plural(receivablesList.length, "venda", "vendas")} com pagamento em falta.`, items: receivablesList.slice(0, 5).map((r) => `${r.client}: ${formatCurrency(r.amount)} (${r.days} dias)`), action: { label: "Ver vendas por pagar", href: links.salesByStatus("Pendente") } });
    }
    if (zeroPrice.length) alerts.push({ id: "zero-price", severity: "warning", title: `${plural(zeroPrice.length, "produto sem preço", "produtos sem preço")}`, detail: "Podem sair a 0 MT numa venda.", items: zeroPrice.slice(0, 5).map((p) => p.name), itemLinks: zeroPrice.slice(0, 5).map((p) => links.product(p.name, p.location)), action: { label: "Corrigir preços", href: links.inventoryProblem("sem-preco") } });
    if (deadValue > 0 && valueAtPrice > 0 && daysSinceLastSale !== null && daysSinceLastSale <= 30) {
        alerts.push({ id: "dead", severity: "info", title: `${formatCurrency(deadValue)} em stock sem vendas registadas há ${deadWindow} dias`, detail: "Capital parado — considere promoção, pacote ou desconto por volume.", items: deadList.slice(0, 5).map((p) => p.name), itemLinks: deadList.slice(0, 5).map((p) => links.product(p.name, p.location)), action: { label: "Ver estes produtos", href: links.products(deadList.map((p) => p.name), `Stock parado há ${deadWindow} dias`) } });
    }
    if (duplicates.length) alerts.push({ id: "dups", severity: "info", title: `${plural(duplicates.length, "produto parece duplicado", "produtos parecem duplicados")}`, detail: "O mesmo artigo registado duas vezes divide o stock e confunde as vendas.", items: duplicates.slice(0, 5), itemLinks: duplicates.slice(0, 5).map((n) => links.product(n)), action: { label: "Rever duplicados", href: links.products([...duplicateNames], "Possíveis duplicados") } });
    if (fractionalUnits.length) alerts.push({ id: "units", severity: "info", title: `${plural(fractionalUnits.length, "produto em 'un'", "produtos em 'un'")} com quantidades decimais`, detail: "Ex.: 23.8 un. Provavelmente a unidade certa é m² ou m — confirme a unidade.", items: fractionalUnits.slice(0, 5).map((p) => `${p.name}: ${fmtQty(p.stock)} un`), itemLinks: fractionalUnits.slice(0, 5).map((p) => links.product(p.name, p.location)), action: { label: "Rever unidades", href: links.inventoryProblem("unidades") } });
    const manualThresholds = products.filter((p) => p.thresholdMode === "manual");
    // contagem em atraso (o mesmo lembrete que o email de acompanhamento). Sem nenhuma contagem, só avisa quem já usa
    // a app há mais tempo do que o prazo — uma empresa nova não tem nada para contar ainda.
    const countEvery = input.countEveryDays && input.countEveryDays >= 7 ? input.countEveryDays : 30;
    const firstMove = movements.map((m) => safeDate(m.timestamp)).filter((d): d is Date => !!d).reduce<Date | null>((a, d) => (!a || d < a ? d : a), null);
    const usedLongEnough = !!firstMove && days(now, firstMove) >= countEvery;
    if (products.length && (daysSinceCount !== null ? daysSinceCount > countEvery : usedLongEnough)) {
        alerts.push({ id: "count", severity: "warning", title: daysSinceCount === null ? "Ainda não fez nenhuma contagem do stock" : `Última contagem do stock há ${daysSinceCount} dias`, detail: "Perdas, enganos e vendas por registar fazem o stock da app afastar-se do que está na prateleira. Uma contagem acerta tudo.", action: { label: "Fazer contagem", href: "/inventory/quick?modo=contagem" } });
    }
    if (manualThresholds.length) alerts.push({ id: "manual-thresholds", severity: "info", title: `${plural(manualThresholds.length, "produto tem", "produtos têm")} limites de stock fixos`, detail: "O alerta baixo e crítico destes não acompanha as vendas: um produto que passa a vender mais pode esgotar sem aviso. Ponha-os em automático.", items: manualThresholds.slice(0, 5).map((p) => p.name), itemLinks: manualThresholds.slice(0, 5).map((p) => links.product(p.name, p.location)), action: { label: "Pôr em automático", href: links.inventoryProblem("limites-manuais") } });
    if (!alerts.length) alerts.push({ id: "ok", severity: "good", title: "Tudo em ordem", detail: "Sem alertas importantes. Continue a registar vendas" + (reseller ? "" : ", produção") + " e contagens." });

    // ---------- headline ----------
    const headline: string[] = [];
    if (daysSinceLastSale !== null && daysSinceLastSale > 7) headline.push(`O sistema não recebe vendas há ${daysSinceLastSale} dias — os números abaixo só são verdadeiros se tudo for registado.`);
    else if (s30.length) headline.push(`Últimos 30 dias: ${formatCurrency(last30)} em ${plural(tickets(s30), "venda", "vendas")}${prev30 > 0 ? ` (${last30 >= prev30 ? "+" : ""}${Math.round(((last30 - prev30) / prev30) * 100)}% face aos 30 anteriores)` : ""}.`);
    if (outOfStock.length || critical.length) headline.push(`${plural(outOfStock.length, "produto esgotado", "produtos esgotados")} e ${critical.length} em nível crítico.`);
    if (qualityScore < 70) headline.push(`Qualidade dos dados: ${qualityScore}% — complete a lista abaixo para análises fiáveis.`);

    return {
        now,
        sales: {
            today: sum(todayS), todayTickets: tickets(todayS),
            last7: sum(s7), last30, prev30, growth30: prev30 > 0 ? ((last30 - prev30) / prev30) * 100 : null,
            month: monthRev, monthTickets: tickets(monthS), lastMonth: sum(lastMonthS),
            projectedMonth: (monthRev / Math.max(1, now.getDate())) * daysInMonth,
            avgTicket30: tickets(s30) ? last30 / tickets(s30) : 0,
            margin30, marginPct30: margin30 !== null && marginBase > 0 ? (margin30 / marginBase) * 100 : null,
            lastSaleDate, daysSinceLastSale,
            topProducts30: Array.from(topMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
            topSellers30: Array.from(sellerMap.values()).map((s) => ({ name: s.name, revenue: s.revenue, tickets: s.guides.size })).sort((a, b) => b.revenue - a.revenue),
            receivables: receivablesList.reduce((t, r) => t + r.amount, 0), receivablesList,
        },
        stock: {
            productCount: products.length, valueAtPrice, valueAtCost,
            outOfStock, critical, low, negative, reservedOverStock, reservedDrift, runout,
            dead: { count: deadList.length, value: deadValue, pctOfValue: valueAtPrice > 0 ? Math.round((deadValue / valueAtPrice) * 100) : 0, examples: deadList.slice(0, 5).map((p) => p.name), days: deadWindow },
            healthScore, pendingPickups, lastCountDate, daysSinceCount,
        },
        production: { lastDate: lastProd, daysSince: daysSinceProd, last30Qty, pendingTransfers: 0 },
        orders: { open, overdue, readyForPickup },
        customers: { total: customers.length, missingContact, inactive, anonymousSalesPct },
        quality: { score: qualityScore, tasks, duplicates, zeroPrice, missingCost, uncategorized, fractionalUnits },
        alerts: alerts.sort((a, b) => rank(a.severity) - rank(b.severity)),
        headline,
    };
}

function rank(s: Severity) {
    return s === "critical" ? 0 : s === "warning" ? 1 : s === "info" ? 2 : 3;
}

/** Markdown report used by the dashboard "Insights da IA" and the assistant. */
export function analysisToMarkdown(a: Analysis): string {
    let md = `### 📊 Diagnóstico do negócio\n\n`;
    a.headline.forEach((h) => (md += `> ${h}\n>\n`));
    md += `\n#### 🚨 Alertas principais\n`;
    a.alerts.slice(0, 6).forEach((al) => {
        const icon = al.severity === "critical" ? "🔴" : al.severity === "warning" ? "🟠" : al.severity === "info" ? "🔵" : "🟢";
        md += `* ${icon} **${al.title}** — ${al.detail}\n`;
        al.items?.slice(0, 3).forEach((i) => (md += `  - ${i}\n`));
    });
    md += `\n#### 💵 Vendas\n`;
    md += `* Hoje: **${formatCurrency(a.sales.today)}** · Este mês: **${formatCurrency(a.sales.month)}** · Últimos 30 dias: **${formatCurrency(a.sales.last30)}**\n`;
    if (a.sales.avgTicket30) md += `* Valor médio por venda (30 dias): **${formatCurrency(a.sales.avgTicket30)}**\n`;
    if (a.sales.marginPct30 !== null) md += `* Margem bruta (30 dias, produtos com custo): **${a.sales.marginPct30.toFixed(0)}%**\n`;
    if (a.sales.topProducts30.length) {
        md += `* 🏆 Mais vendidos (30 dias):\n`;
        a.sales.topProducts30.slice(0, 3).forEach((t, i) => (md += `  ${i + 1}. **${t.name}** — ${fmtQty(t.qty)} ${t.unit}, ${formatCurrency(t.revenue)}\n`));
    }
    md += `\n#### 📦 Stock\n`;
    md += `* Valor em armazém (preço de venda): **${formatCurrency(a.stock.valueAtPrice)}** em ${a.stock.productCount} produtos.\n`;
    md += `* Esgotados: **${a.stock.outOfStock.length}** · Críticos: **${a.stock.critical.length}** · Baixos: **${a.stock.low.length}**\n`;
    md += `\n#### ✅ Qualidade dos dados: ${a.quality.score}%\n`;
    a.quality.tasks.forEach((t) => (md += `* ${t.done ? "✅" : "⬜"} **${t.label}** — ${t.detail}\n`));
    return md;
}
