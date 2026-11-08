"use client";

import { useMemo } from "react";
import { isThisMonth, parseISO } from "date-fns";
import { MapPin } from "lucide-react";
import { useInventory } from "@/context/inventory-context";
import { formatCurrency } from "@/lib/utils";
import { isCountableSale, saleIncome } from "@/lib/sale-filters";
import { siteTotals, sitesOf } from "@/lib/sites";

/** Por ponto: valor do stock e vendas do mês de cada ponto (só aparece com 2 ou mais pontos). */
export function SiteTotals() {
    const { allLocations, isMultiLocation, products, sales } = useInventory();
    const rows = useMemo(() => {
        if (!isMultiLocation || sitesOf(allLocations || []).length < 2) return [];
        const month = (sales || []).filter((s) => isCountableSale(s) && isThisMonth(parseISO(s.date)));
        return siteTotals(allLocations || [], products || [], month, saleIncome);
    }, [allLocations, isMultiLocation, products, sales]);
    if (!rows.length) return null;
    return (
        <div className="rounded-3xl border bg-card p-4" data-testid="site-totals">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Por ponto
            </h3>
            <div className="divide-y">
                {rows.map((r) => (
                    <div key={r.site} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="font-semibold">{r.site}</span>
                        <span className="text-right text-muted-foreground">
                            <b className="text-foreground">{formatCurrency(r.monthSales, { compact: true })}</b> vendido este mês
                            <span className="block text-xs">{formatCurrency(r.stockValue, { compact: true })} em stock</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
