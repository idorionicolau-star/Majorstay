"use client";

import { useContext, useMemo } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { useCRM } from "@/context/crm-context";
import Link from "next/link";
import { cn, daysAgo, formatCurrency, plural } from "@/lib/utils";
import { analyzeBusiness, type Severity } from "@/lib/business-analysis";
import { links } from "@/lib/deep-links";
import {
    ShoppingCart, AlertTriangle, TrendingUp, Sun, Zap, PackagePlus, PackageCheck,
    ClipboardCheck, Truck, CircleDollarSign, CheckCircle2, ChevronRight,
} from "lucide-react";

const SEVERITY: Record<Severity, { box: string; dot: string }> = {
    critical: { box: "border-red-500/30 bg-red-500/5", dot: "bg-red-500" },
    warning: { box: "border-amber-500/30 bg-amber-500/5", dot: "bg-amber-500" },
    info: { box: "border-sky-500/20 bg-sky-500/5", dot: "bg-sky-500" },
    good: { box: "border-emerald-500/20 bg-emerald-500/5", dot: "bg-emerald-500" },
};

const TILE_TONES = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
    slate: "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800",
} as const;

function Tile({ href, icon: Icon, label, value, sub, tone }: {
    href: string; icon: React.ElementType; label: string; value: string; sub: string; tone: keyof typeof TILE_TONES;
}) {
    const [text] = TILE_TONES[tone].split(" bg-");
    return (
        <Link href={href} className="group rounded-xl bg-white dark:bg-slate-800/80 border border-border/60 p-3 hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", TILE_TONES[tone])}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <p className={cn("text-lg font-bold", text)}>{value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
        </Link>
    );
}

export const BusinessSummary = () => {
    const context = useContext(InventoryContext);
    if (!context) return null;
    return <BusinessSummaryInner context={context} />;
};

const BusinessSummaryInner = ({ context }: { context: NonNullable<React.ContextType<typeof InventoryContext>> }) => {

    const { sales, products, companyData, loading } = context;
    const inv = context;

    const { customers } = useCRM();
    const canSell = context.canEdit('sales');
    const canStock = context.canEdit('inventory');

    // Mesmo motor do Diagnóstico — uma só fonte para "o que está mal".
    const analysis = useMemo(() => {
        if (loading || !sales || !products) return null;
        return analyzeBusiness({
            products, sales, customers: customers || [],
            orders: inv.orders || [], productions: inv.productions || [],
            stockMovements: inv.stockMovements || [], businessType: companyData?.businessType, multiLocation: inv.isMultiLocation,
            countEveryDays: companyData?.countEveryDays,
        });
    }, [loading, sales, products, customers, inv.orders, inv.productions, inv.stockMovements, companyData?.businessType, companyData?.countEveryDays]);


    if (loading || !analysis) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
                ))}
            </div>
        );
    }

    const a = analysis;
    // por levantar: as vendas pagas e as encomendas ainda não entregues (antes as encomendas não contavam)
    const pickupSales = a.stock.pendingPickups.length;
    const pickupOrders = a.orders.open.length;
    const attention = a.alerts.filter(al => al.severity !== 'good').slice(0, 4);
    const lateSales = a.sales.daysSinceLastSale === null || a.sales.daysSinceLastSale > 7;

    const shortcuts = [
        { label: 'Vender', href: '/pos', icon: Zap, show: canSell, tone: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
        { label: 'Entrada', href: '/inventory/quick?modo=entrada', icon: PackagePlus, show: canStock, tone: 'bg-white dark:bg-slate-800 hover:bg-muted' },
        { label: 'Contagem', href: '/inventory/quick?modo=contagem', icon: ClipboardCheck, show: canStock, tone: 'bg-white dark:bg-slate-800 hover:bg-muted' },
        { label: 'Lista de carga', href: '/sales/carga', icon: Truck, show: context.canView('sales'), tone: 'bg-white dark:bg-slate-800 hover:bg-muted' },
    ].filter(sc => sc.show);

    return (
        <div data-tour="dash-today" className="rounded-2xl border border-border/60 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 dark:from-slate-900 dark:via-slate-900/80 dark:to-blue-950/20 p-4 md:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Sun className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground tracking-wide">Hoje</h2>
                <span className="text-[10px] text-muted-foreground capitalize">
                    {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-auto truncate max-w-[40%]">
                    {companyData?.name || 'Empresa'}
                </span>
            </div>

            {/* 1. Hoje — os números do dia */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-tour="dash-tiles">
                <Tile href="/sales" icon={TrendingUp} label="Vendido hoje" tone="emerald"
                    value={formatCurrency(a.sales.today, { compact: true })}
                    sub={a.sales.todayTickets === 0 ? 'ainda nenhuma venda' : plural(a.sales.todayTickets, 'venda', 'vendas')} />
                <Tile href="/sales" icon={ShoppingCart} label="Este mês" tone="blue"
                    value={formatCurrency(a.sales.month, { compact: true })}
                    sub={plural(a.sales.monthTickets, 'venda', 'vendas')} />
                <Tile href={links.salesByStatus('Pendente')} icon={CircleDollarSign} label="Por receber" tone={a.sales.receivables > 0 ? 'rose' : 'slate'}
                    value={formatCurrency(a.sales.receivables, { compact: true })}
                    sub={a.sales.receivablesList.length ? plural(a.sales.receivablesList.length, 'cliente deve', 'clientes devem') : 'nada em falta'} />
                <Tile href={pickupSales === 0 && pickupOrders > 0 ? '/orders' : links.salesByStatus('Pago')} icon={PackageCheck} label="Por levantar" tone={pickupSales + pickupOrders > 0 ? 'amber' : 'slate'}
                    value={String(pickupSales + pickupOrders)}
                    sub={pickupSales + pickupOrders === 0 ? 'nada à espera' : [pickupSales ? plural(pickupSales, 'venda paga', 'vendas pagas') : '', pickupOrders ? plural(pickupOrders, 'encomenda', 'encomendas') : ''].filter(Boolean).join(' · ')} />
            </div>

            {/* 2. Atalhos — o que se faz todos os dias */}
            {shortcuts.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2" data-tour="dash-shortcuts">
                    {shortcuts.map(sc => (
                        <Link key={sc.href} href={sc.href}
                            className={cn("flex items-center justify-center gap-2 h-11 rounded-xl border border-border/60 text-sm font-semibold transition-colors", sc.tone)}>
                            <sc.icon className="h-4 w-4" /> {sc.label}
                        </Link>
                    ))}
                </div>
            )}

            {/* 3. Atenção — o que precisa de ser resolvido, com link directo (sem nada a resolver: "Tudo em ordem") */}
            <div className="mt-4" data-tour="dash-attention">
                <div className="flex items-center gap-2 mb-2">
                    {attention.length === 0
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    <h3 className={cn("text-xs font-bold uppercase tracking-wider", attention.length === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        {attention.length === 0 ? "Tudo em ordem" : "Atenção"}
                    </h3>
                    <Link href="/diagnostico" className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        Diagnóstico completo <ChevronRight className="h-3 w-3" />
                    </Link>
                </div>
                {attention.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Continue a registar as vendas do dia.</p>
                ) : (
                    <ul className="space-y-1.5">
                        {attention.map(al => {
                            const sev = SEVERITY[al.severity];
                            const body = (
                                <>
                                    <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", sev.dot)} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-foreground">{al.title}</span>
                                        {al.action && <span className="block text-xs text-muted-foreground">{al.action.label}</span>}
                                    </span>
                                    {al.action && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                                </>
                            );
                            const cls = cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors", sev.box, al.action && "hover:bg-muted/60");
                            return (
                                <li key={al.id}>
                                    {al.action ? <Link href={al.action.href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {lateSales && a.sales.daysSinceLastSale !== null && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                        Última venda registada {daysAgo(a.sales.daysSinceLastSale)}. Os números acima só batem certo se todas as vendas forem registadas.
                    </p>
                )}
            </div>

        </div>
    );
};
