"use client";

import { useContext, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CheckCircle2, CircleDollarSign, ClipboardCheck, Info,
  Package, ShieldAlert, ShoppingCart, TrendingDown, TrendingUp, Truck, Users, WifiOff,
} from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { CRMContext } from "@/context/crm-context";
import { analyzeBusiness, isLearning, runoutLabel, type Alert, type Severity } from "@/lib/business-analysis";
import { StockHealthScore } from "@/components/diagnostico/stock-health-score";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cardMoneySize, cn, daysAgo, formatCardMoney, formatCurrency, plural } from "@/lib/utils";
import { links } from "@/lib/deep-links";
import { openSale } from "@/components/sales/sale-sheet";

const SEV: Record<Severity, { box: string; icon: React.ElementType; iconColor: string; label: string }> = {
  critical: { box: "border-red-500/30 bg-red-500/5", icon: ShieldAlert, iconColor: "text-red-500", label: "Urgente" },
  warning: { box: "border-amber-500/30 bg-amber-500/5", icon: AlertTriangle, iconColor: "text-amber-500", label: "Atenção" },
  info: { box: "border-sky-500/30 bg-sky-500/5", icon: Info, iconColor: "text-sky-500", label: "Sugestão" },
  good: { box: "border-emerald-500/30 bg-emerald-500/5", icon: CheckCircle2, iconColor: "text-emerald-500", label: "Tudo bem" },
};

const qty = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function DiagnosticoPage() {
  const inv = useContext(InventoryContext);
  const crm = useContext(CRMContext);

  const a = useMemo(() => {
    if (!inv || inv.loading) return null;
    return analyzeBusiness({
      products: inv.products,
      sales: inv.sales,
      orders: inv.orders,
      productions: inv.productions,
      customers: crm?.customers || [],
      stockMovements: inv.stockMovements,
      businessType: inv.companyData?.businessType,
      multiLocation: inv.isMultiLocation,
    });
  }, [inv, crm?.customers]);

  if (!a) return <LoadingSkeleton />;

  // Comércio de revenda: sem encomendas nem produção.
  const reseller = inv?.companyData?.businessType === "reseller";
  const salesStale = a.sales.daysSinceLastSale === null || a.sales.daysSinceLastSale > 7;
  const openTasks = a.quality.tasks.filter((t) => !t.done);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Diagnóstico do Negócio</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5" /> Calculado agora no seu aparelho, com os dados registados — funciona sem internet.
        </p>
      </div>

      {/* Headline — the one thing to know */}
      {a.headline.length > 0 && (
        <div data-tour="diag-headline" className={cn("rounded-2xl border p-4 md:p-5", salesStale ? SEV.critical.box : "border-border bg-muted/30")}>
          <p className={cn("text-base md:text-lg font-semibold", salesStale && "text-red-600 dark:text-red-400")}>{a.headline[0]}</p>
          {a.headline.slice(1).map((h) => (
            <p key={h} className="mt-1 text-sm text-muted-foreground">{h}</p>
          ))}
          {salesStale && (
            <Button asChild className="mt-3 bg-red-600 text-white hover:bg-red-700">
              <Link href="/pos">Registar vendas agora <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="diag-kpis">
        <Kpi label="Vendas este mês" value={a.sales.month} sub={`${plural(a.sales.monthTickets, "venda", "vendas")} · mês passado ${formatCardMoney(a.sales.lastMonth)}`} icon={ShoppingCart} />
        <Kpi
          label="Últimos 30 dias"
          value={a.sales.last30}
          sub={a.sales.growth30 === null ? "sem base de comparação" : `${a.sales.growth30 >= 0 ? "+" : ""}${a.sales.growth30.toFixed(0)}% vs. 30 dias antes`}
          icon={a.sales.growth30 !== null && a.sales.growth30 < 0 ? TrendingDown : TrendingUp}
          tone={a.sales.growth30 === null ? undefined : a.sales.growth30 >= 0 ? "good" : "bad"}
        />
        <Kpi label="Valor em stock" value={a.stock.valueAtPrice} sub={`${a.stock.productCount} produtos (a preço de venda)`} icon={Package} />
        <Kpi label="Por receber" value={a.sales.receivables} sub={`${plural(a.sales.receivablesList.length, "venda", "vendas")} com saldo em falta`} icon={CircleDollarSign} tone={a.sales.receivables > 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Data quality — pushes the user to register what is missing */}
        <Card className="min-w-0 rounded-2xl lg:col-span-2" data-tour="diag-quality">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="h-5 w-5 text-primary" /> Confiança dos números</CardTitle>
            <p className="text-sm text-muted-foreground">
              {openTasks.length === 0
                ? "Os dados estão completos — as análises abaixo são fiáveis."
                : `${openTasks.length === 1 ? "Falta 1 passo" : `Faltam ${openTasks.length} passos`} para as análises serem fiáveis. Cada um leva poucos minutos.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center"><StockHealthScore score={a.quality.score} label="DADOS COMPLETOS" /></div>
            <ul className="space-y-2">
              {a.quality.tasks.map((t) => (
                <li key={t.id} className={cn("rounded-xl border p-3", t.done ? "border-emerald-500/20 bg-emerald-500/5" : "border-border")}>
                  <div className="flex flex-wrap items-start gap-2">
                    {t.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />}
                    <div className="min-w-[13rem] flex-1">
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.detail}</p>
                    </div>
                    {!t.done && t.action && (
                      <Button asChild size="sm" variant="outline" className="ml-6 h-8 shrink-0 text-xs sm:ml-0">
                        <Link href={t.action.href}>{t.action.label}</Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Alerts */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-3" data-tour="diag-alerts">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-amber-500" /> Alertas principais</h2>
          {a.alerts.map((al) => <AlertCard key={al.id} alert={al} />)}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2" data-tour="diag-details">
        {/* Stock */}
        <Card className="min-w-0 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Package className="h-5 w-5 text-primary" /> Stock</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={a.stock.outOfStock.length} label="Esgotados" tone="bad" href={links.inventoryProblem("esgotado")} />
              <Stat n={a.stock.critical.length} label="Críticos" tone="warn" href={links.inventoryProblem("critico")} />
              <Stat n={a.stock.low.length} label="Baixos" href={links.inventoryProblem("baixo")} />
            </div>
            <Section title="Vão esgotar em ≤ 14 dias">
              {salesStale ? (
                <Empty>Sem vendas recentes registadas não dá para prever. Registe as vendas e esta lista passa a funcionar.</Empty>
              ) : a.stock.runout.some((r) => r.available > 0 && !isLearning(r)) ? (
                a.stock.runout.filter((r) => r.available > 0 && !isLearning(r)).slice(0, 6).map((r) => (
                  <Row key={`${r.name}${r.location}`} left={r.name} right={`${runoutLabel(r.daysLeft)} · ${qty(r.available)} ${r.unit}`} tone={r.daysLeft <= 5 ? "bad" : "warn"} href={links.product(r.name, r.location)} />
                ))
              ) : <Empty>Nada em risco ao ritmo actual de vendas. 👍</Empty>}
            </Section>
            <Section title={`Stock parado (${a.stock.dead.days >= 30 ? a.stock.dead.days : 90} dias sem vendas)`}>
              {salesStale ? (
                <Empty>Parece tudo parado porque as vendas não estão a ser registadas — não é sinal para liquidar stock.</Empty>
              ) : a.stock.dead.count ? (
                <p className="text-sm"><b>{formatCurrency(a.stock.dead.value)}</b> em {a.stock.dead.count} produtos ({a.stock.dead.pctOfValue}% do valor). Ex.: {a.stock.dead.examples.slice(0, 3).join(", ")}.</p>
              ) : <Empty>{a.stock.dead.days >= 30 ? `Todo o stock teve vendas nos últimos ${a.stock.dead.days} dias.` : "Ainda há poucas vendas registadas na app (menos de 30 dias) para saber o que está parado."}</Empty>}
            </Section>
            <p className="text-xs text-muted-foreground">Última contagem física: <b>{a.stock.lastCountDate ? fmtDate(a.stock.lastCountDate) : "nunca feita no sistema"}</b>.{" "}
              <Link className="underline" href="/inventory/quick?modo=contagem">Fazer contagem</Link></p>
          </CardContent>
        </Card>

        {/* Sales */}
        <Card className="min-w-0 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-primary" /> Vendas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <MiniKpi label="Hoje" value={formatCardMoney(a.sales.today)} full={formatCurrency(a.sales.today)} sub={plural(a.sales.todayTickets, "venda", "vendas")} />
              <MiniKpi label="Valor médio por venda" value={a.sales.avgTicket30 ? formatCardMoney(a.sales.avgTicket30) : "—"} full={a.sales.avgTicket30 ? formatCurrency(a.sales.avgTicket30) : undefined} sub="30 dias" />
              <MiniKpi label="Margem bruta" value={a.sales.marginPct30 !== null ? `${a.sales.marginPct30.toFixed(0)}%` : "—"} sub={a.sales.marginPct30 !== null ? "produtos com custo" : `${a.quality.missingCost.length} produtos sem custo`} />
              <MiniKpi label="Última venda" value={fmtDate(a.sales.lastSaleDate)} sub={a.sales.daysSinceLastSale !== null ? daysAgo(a.sales.daysSinceLastSale) : "nenhuma"} tone={salesStale ? "bad" : undefined} />
            </div>
            <Section title="Mais vendidos (30 dias)">
              {a.sales.topProducts30.length ? a.sales.topProducts30.map((t, i) => (
                <Row key={t.name} left={`${i + 1}. ${t.name}`} right={`${qty(t.qty)} ${t.unit} · ${formatCurrency(t.revenue)}`} href={links.salesOfProduct(t.name)} />
              )) : <Empty>Sem vendas registadas nos últimos 30 dias.</Empty>}
            </Section>
            {a.sales.topSellers30.length > 0 && (
              <Section title="Por funcionário (30 dias)">
                {a.sales.topSellers30.map((s) => <Row key={s.name} left={s.name} right={`${formatCurrency(s.revenue)} · ${plural(s.tickets, "venda", "vendas")}`} />)}
              </Section>
            )}
          </CardContent>
        </Card>

        {/* Orders & pickups */}
        <Card className="min-w-0 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Truck className="h-5 w-5 text-primary" /> {reseller ? "Levantamentos" : "Encomendas e levantamentos"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("grid gap-2 text-center", reseller ? "grid-cols-1" : "grid-cols-3")}>
              {!reseller && <Stat n={a.orders.open.length} label="Em aberto" />}
              {!reseller && <Stat n={a.orders.overdue.length} label="Atrasadas" tone={a.orders.overdue.length ? "bad" : undefined} href="/orders" />}
              <Stat n={a.orders.readyForPickup.length + a.stock.pendingPickups.length} label="Por levantar" tone="warn" />
            </div>
            {a.orders.readyForPickup.length > 0 && (
              <Section title="Encomendas prontas — avise o cliente">
                {a.orders.readyForPickup.slice(0, 5).map((o) => <Row key={o.id} left={o.productName} right={o.clientName || "cliente"} href={links.order(o.id)} />)}
              </Section>
            )}
            {a.stock.pendingPickups.length > 0 && (
              <Section title="Vendas pagas ainda não levantadas">
                <Row left="Abrir lista de carga" right="→" href="/sales/carga" />
                {a.stock.pendingPickups.slice(0, 5).map((p) => <Row key={p.sale.id} left={`${p.sale.productName} × ${qty(p.sale.quantity)}`} right={`${p.sale.clientName || "cliente"} · ${daysAgo(p.days)}`} tone={p.days > 7 ? "warn" : undefined} onClick={() => openSale(p.sale.id)} />)}
              </Section>
            )}
            {!a.orders.open.length && !a.stock.pendingPickups.length && <Empty>Nada pendente.</Empty>}
          </CardContent>
        </Card>

        {/* Customers */}
        <Card className="min-w-0 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" /> Clientes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={a.customers.total} label="Registados" />
              <Stat n={a.customers.missingContact} label="Sem contacto" tone={a.customers.missingContact ? "warn" : undefined} />
              <Stat n={a.customers.anonymousSalesPct ?? 0} suffix="%" label="Vendas sem nome" tone={(a.customers.anonymousSalesPct || 0) > 50 ? "warn" : undefined} />
            </div>
            {(a.customers.anonymousSalesPct || 0) > 50 && (
              <p className="text-sm text-muted-foreground">Escreva o nome do cliente na venda — assim sabe quem compra mais e quem deixou de vir.</p>
            )}
            <Section title="Bons clientes que não voltam há +45 dias">
              {a.customers.inactive.length ? a.customers.inactive.slice(0, 5).map((c) => (
                <Row key={c.id} left={c.name} right={`${formatCurrency(c.totalPurchases || 0)}${c.phone ? ` · ${c.phone}` : ""}`} href={links.customer(c.name)} />
              )) : <Empty>{a.customers.total ? "Nenhum cliente importante afastado." : "Registe clientes nas vendas para ver esta lista."}</Empty>}
            </Section>
            <Button asChild variant="outline" size="sm"><Link href="/customers">Ver clientes</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const s = SEV[alert.severity];
  const Icon = s.icon;
  return (
    <div className={cn("rounded-2xl border p-4", s.box)}>
      <div className="flex flex-wrap items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.iconColor)} />
        <div className="min-w-[13rem] flex-1">
          <p className="font-semibold leading-snug">{alert.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{alert.detail}</p>
          {alert.items && alert.items.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm">
              {alert.items.map((i, idx) => {
                const href = alert.itemLinks?.[idx];
                return (
                  <li key={`${i}-${idx}`} className="truncate">
                    {href ? <Link href={href} className="underline-offset-2 hover:underline">• {i}</Link> : <>• {i}</>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {alert.action && (
          <Button asChild size="sm" variant="ghost" className="ml-8 shrink-0 text-xs sm:ml-0">
            <Link href={alert.action.href}>{alert.action.label} <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: number; sub: string; icon: React.ElementType; tone?: "good" | "bad" }) {
  const text = formatCardMoney(value);
  return (
    <Card className="min-w-0 rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}<Icon className="h-4 w-4" /></div>
        <p className={cn("mt-2 font-bold tabular-nums [overflow-wrap:anywhere]", cardMoneySize(text))} title={formatCurrency(value)}>{text}</p>
        <p className={cn("mt-1 text-xs text-muted-foreground", tone === "good" && "text-emerald-600", tone === "bad" && "text-red-500")}>{sub}</p>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ label, value, full, sub, tone }: { label: string; value: string; full?: string; sub: string; tone?: "bad" }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-bold tabular-nums [overflow-wrap:anywhere]", tone === "bad" && "text-red-500")} title={full}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Stat({ n, label, tone, suffix = "", href }: { n: number; label: string; tone?: "bad" | "warn"; suffix?: string; href?: string }) {
  const inner = (
    <>
      <p className={cn("text-2xl font-bold tabular-nums", tone === "bad" && n > 0 && "text-red-500", tone === "warn" && n > 0 && "text-amber-500")}>{n}{suffix}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </>
  );
  return href && n > 0
    ? <Link href={href} className="block rounded-xl bg-muted/40 p-3 transition hover:bg-muted">{inner}</Link>
    : <div className="rounded-xl bg-muted/40 p-3">{inner}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ left, right, tone, href, onClick }: { left: string; right: string; tone?: "bad" | "warn"; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="min-w-0 truncate">{left}</span>
      <span className={cn("shrink-0 tabular-nums text-muted-foreground", tone === "bad" && "text-red-500 font-semibold", tone === "warn" && "text-amber-500 font-semibold")}>{right}</span>
    </>
  );
  const cls = "flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40";
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, "w-full text-left")}>{body}</button>;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
