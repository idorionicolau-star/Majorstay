"use client";

import { locationLabel } from '@/lib/sites';
import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DeepLinkBanner } from "@/components/deep-link-banner";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, MapPin, PackageMinus, ShieldAlert, User } from "lucide-react";
import { useInventory } from "@/context/inventory-context";
import { ProductsTabs } from "@/components/inventory/products-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, normalizeString } from "@/lib/utils";
import type { StockMovement } from "@/lib/types";

type Kind = "falta" | "sobra" | "perda" | "justificada";
type Event = { id: string; date: Date; kind: Kind; product: string; qty: number; value: number; location: string; user: string; reason: string };

const PERIODS = [7, 30, 90, 365];
// Saídas manuais consideradas perda (as restantes — consumo interno, oferta, devolução — são justificadas)
const LOSS_WORDS = ["perda", "quebra", "dano", "roubo", "desaparec", "sem motivo"];

const toDate = (t: unknown): Date | null => {
    const v = t as { toDate?: () => Date } | string | undefined;
    if (!v) return null;
    const d = typeof v === "object" && typeof v.toDate === "function" ? v.toDate() : new Date(v as string);
    return isNaN(d.getTime()) ? null : d;
};

export default function LossesPage() {
    const { stockMovements, products, locations, user } = useInventory();
    const isManager = !!user && (user.role === "Admin" || user.role === "Dono");
    const [days, setDays] = useState(30);
    const [loc, setLoc] = useState<string>("all");
    const searchParams = useSearchParams();
    const router = useRouter();
    // Vindo de um aviso sobre um produto: só os registos desse produto.
    const onlyProduct = searchParams.get("produto");

    const priceOf = useMemo(() => {
        const byId = new Map<string, number>();
        const byName = new Map<string, number>();
        products.forEach((p) => {
            (p.sourceIds?.length ? p.sourceIds : [p.id]).forEach((id) => id && byId.set(id, p.price || 0));
            if (p.price) byName.set(normalizeString(p.name), p.price);
        });
        return (m: StockMovement) => byId.get(m.productId) || byName.get(normalizeString(m.productName)) || 0;
    }, [products]);

    const events = useMemo<Event[]>(() => {
        const since = Date.now() - days * 86_400_000;
        const out: Event[] = [];
        (stockMovements || []).forEach((m: StockMovement & { id?: string }) => {
            const date = toDate(m.timestamp);
            if (!date || date.getTime() < since) return;
            const location = (m.type === "OUT" ? m.fromLocationId : m.toLocationId) || m.fromLocationId || m.toLocationId || "";
            if (loc !== "all" && location !== loc) return;
            if (onlyProduct && normalizeString(m.productName) !== normalizeString(onlyProduct)) return;
            const reason = m.reason || "";
            const base = { id: m.id || `${m.productId}-${date.getTime()}`, date, product: m.productName, location, user: m.userName || "—", reason };
            if (m.type === "ADJUSTMENT" && m.quantity !== 0) {
                const q = Math.abs(m.quantity);
                out.push({ ...base, kind: m.quantity < 0 ? "falta" : "sobra", qty: q, value: q * priceOf(m) });
            } else if (m.type === "OUT" && /sa[ií]da r[aá]pida/i.test(reason)) {
                const q = Math.abs(m.quantity);
                const isLoss = LOSS_WORDS.some((w) => normalizeString(reason).includes(w)) || !reason.includes(":");
                out.push({ ...base, kind: isLoss ? "perda" : "justificada", qty: q, value: q * priceOf(m) });
            }
        });
        return out.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [stockMovements, days, loc, priceOf, onlyProduct]);

    const sum = (k: Kind) => events.filter((e) => e.kind === k).reduce((t, e) => t + e.value, 0);
    const lost = sum("falta") + sum("perda");

    const group = (key: (e: Event) => string) => {
        const m = new Map<string, { name: string; value: number; qty: number; n: number }>();
        events.filter((e) => e.kind === "falta" || e.kind === "perda").forEach((e) => {
            const k = key(e);
            const g = m.get(k) || { name: k, value: 0, qty: 0, n: 0 };
            g.value += e.value; g.qty += e.qty; g.n += 1;
            m.set(k, g);
        });
        return Array.from(m.values()).sort((a, b) => b.value - a.value);
    };
    const byProduct = group((e) => e.product);
    const byLocation = group((e) => locations.find((l) => l.id === e.location)?.name || e.location || "—");
    const byUser = group((e) => e.user);

    if (!isManager) return <p className="text-muted-foreground">Esta página é só para o gestor da empresa.</p>;

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-24">
            <ProductsTabs />
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldAlert className="h-6 w-6 text-red-500" /> Perdas e faltas</h1>
                    <p className="text-sm text-muted-foreground">O que as contagens encontraram a menos e as saídas registadas como perda ou quebra.</p>
                </div>
                <Button asChild data-tour="loss-count"><Link href="/inventory/quick?modo=contagem"><ClipboardCheck className="mr-2 h-4 w-4" />Fazer contagem</Link></Button>
            </div>

            {onlyProduct && (
                <DeepLinkBanner title={`Registos de “${onlyProduct}” (${events.length})`} hint="Só este produto — contagens, faltas e saídas." count={events.length} onClear={() => router.replace("/inventory/perdas")} />
            )}

            <div className="flex flex-wrap gap-2" data-tour="loss-period">
                {PERIODS.map((d) => (
                    <button key={d} type="button" onClick={() => setDays(d)} className={cn("rounded-full border px-3 py-1.5 text-sm", days === d ? "border-primary bg-primary text-primary-foreground" : "bg-muted/40")}>
                        {d === 365 ? "1 ano" : `${d} dias`}
                    </button>
                ))}
                {locations.length > 1 && (
                    <select value={loc} onChange={(e) => setLoc(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-sm">
                        <option value="all">Todas as localizações</option>
                        {locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
                    </select>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-tour="loss-tiles">
                <Tile label="Total perdido" value={formatCurrency(lost)} tone="bad" />
                <Tile label="Faltas em contagens" value={formatCurrency(sum("falta"))} sub={`${events.filter((e) => e.kind === "falta").length} registos`} />
                <Tile label="Perdas / quebras declaradas" value={formatCurrency(sum("perda"))} sub={`${events.filter((e) => e.kind === "perda").length} registos`} />
                <Tile label="Sobras em contagens" value={formatCurrency(sum("sobra"))} sub="entrada não registada?" tone="warn" />
            </div>

            {lost === 0 && (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                    Sem perdas neste período. {events.length === 0 && "Faça contagens regulares (uma vez por semana, por localização) — é assim que as faltas aparecem aqui."}
                </div>
            )}

            {lost > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Rank title="Por produto" icon={PackageMinus} rows={byProduct} />
                    <Rank title="Por localização" icon={MapPin} rows={byLocation} />
                    <Rank title="Por funcionário que registou" icon={User} rows={byUser} note="Quem contou ou registou a saída — não quer dizer que foi quem levou." />
                </div>
            )}

            {events.length > 0 && (
                <Card className="rounded-2xl">
                    <CardHeader className="pb-2"><CardTitle className="text-lg">Registos</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        {events.slice(0, 150).map((e) => (
                            <div key={e.id} className="flex items-center gap-3 border-t px-4 py-2.5 text-sm">
                                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                                    e.kind === "falta" && "bg-red-500/15 text-red-600",
                                    e.kind === "perda" && "bg-orange-500/15 text-orange-600",
                                    e.kind === "sobra" && "bg-sky-500/15 text-sky-600",
                                    e.kind === "justificada" && "bg-muted text-muted-foreground")}>{e.kind}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{e.product} · {e.kind === "sobra" ? "+" : "−"}{Number.isInteger(e.qty) ? e.qty : e.qty.toFixed(1)}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {e.date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })} · {e.user}
                                        {locations.length > 1 ? ` · ${locations.find((l) => l.id === e.location)?.name || "—"}` : ""} · {e.reason}
                                    </p>
                                </div>
                                <span className={cn("shrink-0 font-semibold tabular-nums", (e.kind === "falta" || e.kind === "perda") && "text-red-600")}>{formatCurrency(e.value)}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="flex items-start gap-2 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Para as faltas serem reais, as vendas e a produção têm de estar registadas. Uma venda não registada aparece aqui como falta. Os funcionários fazem <b>contagem cega</b> (não vêem o stock do sistema), por isso não conseguem "acertar" a contagem para esconder faltas.</p>
            </div>
        </div>
    );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" | "warn" }) {
    return (
        <Card className="rounded-2xl">
            <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={cn("mt-1 text-xl font-bold tabular-nums", tone === "bad" && "text-red-600", tone === "warn" && "text-sky-600")}>{value}</p>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
        </Card>
    );
}

function Rank({ title, icon: Icon, rows, note }: { title: string; icon: React.ElementType; rows: { name: string; value: number; n: number }[]; note?: string }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-muted-foreground" />{title}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                {rows.slice(0, 8).map((r) => (
                    <div key={r.name}>
                        <div className="flex justify-between gap-2 text-sm"><span className="truncate">{r.name}</span><span className="shrink-0 font-semibold tabular-nums text-red-600">{formatCurrency(r.value)}</span></div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-red-500" style={{ width: `${(r.value / max) * 100}%` }} /></div>
                    </div>
                ))}
                {note && <p className="pt-1 text-[11px] text-muted-foreground">{note}</p>}
            </CardContent>
        </Card>
    );
}
