"use client";

import { useContext, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { Button } from "@/components/ui/button";
import { reservedDrifts } from "@/lib/reserved-stock";

/**
 * Aviso no Inventário (só para quem gere o stock): há produtos com reservado que nenhuma venda paga por levantar
 * nem encomenda justifica. Sem isto a quantidade fica presa para sempre, sem ninguém perceber porquê.
 */
export function ReservedDriftBanner() {
    const ctx = useContext(InventoryContext);
    const [busy, setBusy] = useState(false);
    const drift = useMemo(
        () => (ctx && !ctx.loading ? reservedDrifts((ctx.products || []).filter((p) => (p.reservedStock || 0) > 0), ctx.sales || [], ctx.orders || [], !!ctx.isMultiLocation).filter((d) => d.drift > 0) : []),
        [ctx],
    );
    if (!ctx || !ctx.canEdit?.("inventory") || ctx.isReadOnly || drift.length === 0) return null;
    const total = drift.reduce((t, d) => t + d.drift, 0);
    const fix = async () => {
        setBusy(true);
        try { await ctx.recalculateReservedStock(drift.flatMap((d) => d.product.sourceIds?.length ? d.product.sourceIds : d.product.id ? [d.product.id] : [])); }
        finally { setBusy(false); }
    };
    return (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1">
                <b>{drift.length} produto{drift.length === 1 ? "" : "s"}</b> com reserva sem venda nem encomenda por trás ({total} unidade{total === 1 ? "" : "s"} presa{total === 1 ? "" : "s"}, que não se podem vender).
                {" "}Toque em «reservados» num produto para ver, ou liberte tudo de uma vez.
            </p>
            <Button size="sm" onClick={fix} disabled={busy}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Libertar tudo</Button>
        </div>
    );
}
