"use client";

import { useContext, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { explainReserved } from "@/lib/reserved-stock";
import { links } from "@/lib/deep-links";
import { openSale } from "@/components/sales/sale-sheet";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/lib/types";

const fmtDate = (iso?: string) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d.getTime()) ? d.toLocaleDateString("pt-PT") : ""; };
const fmtQty = (n: number) => new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(n);

/**
 * "N reservados": toque para ver DE ONDE vem — as vendas pagas por levantar e as encomendas que o reservam —
 * e, se houver reserva sem nada por trás (uma reserva presa), libertá-la com um toque.
 * Funciona dentro de ligações e linhas clicáveis (não as abre).
 */
export function ReservedBadge({ product, className, children }: { product: Product; className?: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
    return (
        <>
            <span
                role="button"
                tabIndex={0}
                aria-label={`${product.reservedStock} reservado${product.reservedStock === 1 ? "" : "s"}: ver de onde vem`}
                className={className}
                onClick={(e) => { stop(e); setOpen(true); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { stop(e); setOpen(true); } }}
            >
                {children}
            </span>
            {open && <ReservedDialog product={product} onClose={() => setOpen(false)} />}
        </>
    );
}

function ReservedDialog({ product, onClose }: { product: Product; onClose: () => void }) {
    const ctx = useContext(InventoryContext);
    const [fixing, setFixing] = useState(false);
    const e = useMemo(
        () => explainReserved(product, ctx?.sales || [], ctx?.orders || [], !!ctx?.isMultiLocation),
        [product, ctx?.sales, ctx?.orders, ctx?.isMultiLocation],
    );
    const canFix = !!ctx?.canEdit?.("inventory") && !ctx?.isReadOnly;
    const unit = product.unit || "un";

    const fix = async () => {
        if (!ctx) return;
        setFixing(true);
        try { await ctx.recalculateReservedStock(product.sourceIds?.length ? product.sourceIds : product.id ? [product.id] : []); onClose(); }
        finally { setFixing(false); }
    };

    return (
        <ResponsiveDialog
            open
            onOpenChange={(o) => { if (!o) onClose(); }}
            title={`Reservado: ${product.name}`}
            description="Mercadoria já vendida ou encomendada que ainda não saiu. Não pode ser vendida a outra pessoa."
            className="sm:max-w-[480px]"
        >
            <div className="space-y-4 pb-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl border p-2.5"><p className="text-[11px] text-muted-foreground">Reservado no sistema</p><p className="text-lg font-bold tabular-nums">{fmtQty(e.recorded)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></p></div>
                    <div className="rounded-xl border p-2.5"><p className="text-[11px] text-muted-foreground">Explicado por vendas e encomendas</p><p className="text-lg font-bold tabular-nums">{fmtQty(e.explained)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></p></div>
                </div>

                {e.sales.length > 0 && (
                    <section aria-label="Vendas por levantar">
                        <h3 className="mb-1.5 font-semibold">Vendas pagas por levantar</h3>
                        <ul className="divide-y rounded-xl border">
                            {e.sales.map((s) => (
                                <li key={s.id}>
                                    <button type="button" onClick={() => { onClose(); openSale(s.id); }} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50">
                                        <span className="min-w-0"><span className="block truncate font-medium">{s.guideNumber}{s.clientName ? ` · ${s.clientName}` : ""}</span><span className="block text-xs text-muted-foreground">{fmtDate(s.date)} · {formatCurrency(s.totalValue || 0)}</span></span>
                                        <span className="shrink-0 tabular-nums">{fmtQty(s.quantity)} {unit}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {e.orders.length > 0 && (
                    <section aria-label="Encomendas">
                        <h3 className="mb-1.5 font-semibold">Encomendas</h3>
                        <ul className="divide-y rounded-xl border">
                            {e.orders.map((o) => (
                                <li key={o.id}>
                                    <Link href={links.order(o.id)} onClick={onClose} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50">
                                        <span className="min-w-0"><span className="block truncate font-medium">{o.clientName || "Encomenda"}</span><span className="block text-xs text-muted-foreground">{o.status}{o.deliveryDate ? ` · entrega ${fmtDate(o.deliveryDate)}` : ""}</span></span>
                                        <span className="shrink-0 tabular-nums">{fmtQty(o.reservedQuantity ?? o.quantity)} {unit}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {e.drift > 0 && (
                    <div role="alert" className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                        <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><b>{fmtQty(e.drift)} {unit} reservado{e.drift === 1 ? "" : "s"} sem nenhuma venda ou encomenda por trás.</b> É uma reserva presa (costuma vir de uma venda ou encomenda apagada, ou de dados antigos). Enquanto estiver assim, essa quantidade não pode ser vendida.</span></p>
                        {canFix
                            ? <Button size="sm" onClick={fix} disabled={fixing}>{fixing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Libertar {fmtQty(e.drift)}</Button>
                            : <p className="text-xs text-muted-foreground">Peça a quem gere o inventário para a libertar.</p>}
                    </div>
                )}
                {e.drift < 0 && (
                    <div role="alert" className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                        <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>As vendas e encomendas reservam <b>{fmtQty(-e.drift)} {unit}</b> a mais do que o sistema tem reservado.</span></p>
                        {canFix && <Button size="sm" onClick={fix} disabled={fixing}>{fixing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Acertar reservas</Button>}
                    </div>
                )}
                {e.drift === 0 && e.recorded > 0 && <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Tudo certo: o reservado bate com as vendas e encomendas.</p>}
                {e.recorded === 0 && e.drift === 0 && <p className="text-muted-foreground">Este produto já não tem nada reservado.</p>}
            </div>
        </ResponsiveDialog>
    );
}
