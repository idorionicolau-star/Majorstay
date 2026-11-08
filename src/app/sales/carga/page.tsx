"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Clock, PackageX, Truck } from "lucide-react";
import { useInventory } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { useCuring } from "@/hooks/use-curing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { allocatePickups, type PickupStatus } from "@/lib/curing";
import { cn, formatCurrency, normalizeString } from "@/lib/utils";
import { sameLocation } from "@/lib/product-ref";
import { links } from "@/lib/deep-links";
import type { Sale } from "@/lib/types";
import { orderToDeliver } from "@/lib/order-stock";
import { openSale } from "@/components/sales/sale-sheet";

const fmtQ = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-PT", { maximumFractionDigits: 2 }));
const fmtDay = (d: Date) => d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit" });

/** Lista de carga: as vendas pagas à espera de levantar, separadas em "pode carregar", "ainda a secar" e "falta produzir". */
export default function LoadingListPage() {
    const { sales, products, orders, locations, isMultiLocation, loading, confirmSalePickup, canEdit } = useInventory();
    const { toast } = useToast();
    const curing = useCuring();
    const [busy, setBusy] = useState<string | null>(null);
    const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

    const pending = useMemo(
        () =>
            sales
                .filter((s) => !s.deletedAt && s.status === "Pago" && !s.orderId && s.documentType !== "Encomenda" && s.documentType !== "Factura Proforma" && s.documentType !== "Cotação")
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        [sales],
    );

    const status = useMemo(() => {
        // "Principal" e "" são o mesmo local; uma venda sem local, numa empresa com vários, é do primeiro (como ao levantar)
        const saleLoc = (l?: string) => l || (isMultiLocation ? locations[0]?.id || "" : "");
        const stockOf = (name: string, location?: string) =>
            products
                .filter((p) => !p.deletedAt && normalizeString(p.name) === normalizeString(name) && sameLocation(p.location, location))
                .reduce((t, p) => t + (p.stock || 0), 0);
        return allocatePickups(pending.map((s) => ({ id: s.id, productName: s.productName, quantity: s.quantity, date: s.date, location: saleLoc(s.location) })), stockOf, curing.batches);
    }, [pending, products, curing.batches, isMultiLocation, locations]);

    // encomendas ainda não entregues: o cliente leva-as pela página da encomenda ("Levantar parte" / "Entregar")
    const openOrders = useMemo(() => {
        const stockOf = (name: string, location?: string) =>
            products
                .filter((p) => !p.deletedAt && normalizeString(p.name) === normalizeString(name) && sameLocation(p.location, location))
                .reduce((t, p) => t + (p.stock || 0), 0);
        return (orders || [])
            .filter((o) => !o.deletedAt && o.status !== "Entregue" && orderToDeliver(o) > 0)
            .map((o) => {
                const left = orderToDeliver(o);
                return { o, left, readyNow: Math.min(left, Math.max(0, stockOf(o.productName, o.location || (isMultiLocation ? locations[0]?.id : "")))) };
            });
    }, [orders, products, isMultiLocation, locations]);

    const locName = (id?: string) => locations.find((l) => l.id === id)?.name || "";
    const canConfirm = canEdit("sales");

    const confirm = async (sale: Sale) => {
        setBusy(sale.id);
        try {
            await confirmSalePickup(sale);
            setDoneIds((prev) => new Set(prev).add(sale.id));
            toast({ title: "Carregado", description: `${sale.productName} × ${fmtQ(sale.quantity)} saiu do stock.` });
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível confirmar", description: e instanceof Error ? e.message : "Tente de novo." });
        } finally {
            setBusy(null);
        }
    };

    if (loading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-32 w-full rounded-2xl" /></div>;

    const rows = pending.filter((s) => !doneIds.has(s.id)).map((s) => ({ s, st: (status.get(s.id) || { state: "ready" }) as PickupStatus }));
    const ready = rows.filter((r) => r.st.state === "ready");
    const waiting = rows.filter((r) => r.st.state === "curing").sort((a, b) => (a.st.state === "curing" && b.st.state === "curing" ? a.st.readyAt.getTime() - b.st.readyAt.getTime() : 0));
    const short = rows.filter((r) => r.st.state === "short");

    return (
        <div className="mx-auto w-full max-w-3xl space-y-6 pb-24">
            <div data-tour="carga-head">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Truck className="h-6 w-6 text-primary" /> Lista de carga</h1>
                <p className="text-sm text-muted-foreground">
                    Vendas pagas à espera de levantar.{curing.enabled ? ` O que acabou de ser produzido seca ${curing.days} dias antes de se poder carregar.` : ""} As mais antigas ficam com as peças prontas primeiro.
                </p>
            </div>

            {!rows.length && !openOrders.length && (
                <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Nada à espera de levantamento. 🎉</div>
            )}

            <Group title="Pode carregar agora" icon={CheckCircle2} tone="text-emerald-600" rows={ready} render={(r) => (
                <Card key={r.s.id} sale={r.s} where={isMultiLocation ? locName(r.s.location) : ""}
                    action={canConfirm ? <Button size="sm" disabled={busy === r.s.id} onClick={() => confirm(r.s)}>{busy === r.s.id ? "…" : "Já carregou"}</Button> : null} />
            )} />

            <Group title="Ainda a secar" icon={Clock} tone="text-amber-600" rows={waiting} render={(r) => (
                <Card key={r.s.id} sale={r.s} where={isMultiLocation ? locName(r.s.location) : ""}
                    note={r.st.state === "curing" ? `Pronto para carregar a partir de ${fmtDay(r.st.readyAt)}` : ""} />
            )} />

            <Group title="Falta produzir" icon={PackageX} tone="text-red-600" rows={short} render={(r) => (
                <Card key={r.s.id} sale={r.s} where={isMultiLocation ? locName(r.s.location) : ""}
                    note="Não há peças suficientes, nem contando as que estão a secar." />
            )} />

            {openOrders.length > 0 && (
                <section data-tour="carga-orders">
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><ClipboardList className="h-4 w-4" /> Encomendas ({openOrders.length})</h2>
                    <div className="space-y-2">
                        {openOrders.map(({ o, left, readyNow }) => (
                            <Link key={o.id} href={links.order(o.id)} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 hover:border-primary/60">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">{o.productName} × {fmtQ(left)} {o.unit || ""}</p>
                                    <p className="text-xs text-muted-foreground">{[o.clientName || "cliente", isMultiLocation ? locName(o.location) : ""].filter(Boolean).join(" · ")}</p>
                                </div>
                                <span className={cn("shrink-0 text-right text-xs font-medium", readyNow >= left ? "text-emerald-600" : readyNow > 0 ? "text-amber-600" : "text-red-600")}>
                                    {readyNow >= left ? "Tudo pronto" : readyNow > 0 ? `${fmtQ(readyNow)} prontas` : "Falta produzir"}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <p className="text-xs text-muted-foreground">
                <Link href={links.salesByStatus("Pago")} className="underline">Ver estas vendas no histórico</Link>
            </p>
        </div>
    );
}

type Row = { s: Sale; st: PickupStatus };

function Group({ title, icon: Icon, tone, rows, render }: { title: string; icon: React.ElementType; tone: string; rows: Row[]; render: (r: Row) => React.ReactNode }) {
    if (!rows.length) return null;
    return (
        <section>
            <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", tone)}><Icon className="h-4 w-4" /> {title} ({rows.length})</h2>
            <div className="space-y-2">{rows.map(render)}</div>
        </section>
    );
}

function Card({ sale, where, note, action }: { sale: Sale; where?: string; note?: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
            <button type="button" onClick={() => openSale(sale.id)} className="min-w-0 text-left">
                <p className="truncate font-semibold">{sale.productName} × {fmtQ(sale.quantity)} {sale.unit || ""}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {sale.clientName || "Cliente"} · {sale.guideNumber}{where ? ` · ${where}` : ""} · {formatCurrency(sale.totalValue || 0)}
                </p>
                {note && <p className="mt-0.5 text-xs font-medium text-amber-600">{note}</p>}
            </button>
            {action}
        </div>
    );
}
