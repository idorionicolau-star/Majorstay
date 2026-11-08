
"use client";

import { useState, useMemo, useContext } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { InventoryContext } from "@/context/inventory-context";
import { PackageX } from 'lucide-react';
import { Skeleton } from "../ui/skeleton";
import { cn, formatCompactNumber } from "@/lib/utils";

export function DeadStock({ className }: { className?: string }) {
    const { products, sales, loading } = useContext(InventoryContext) || { products: [], sales: [], loading: true };

    const deadStockProducts = useMemo(() => {
        if (!products || !sales) return [];

        // Create a Set of sold product names for O(1) lookups
        const soldProductNames = new Set(sales.map(s => s.productName));

        // Filter products that are NOT in the sold set
        const unsold = products.filter(p => !soldProductNames.has(p.name));

        // Sort by Stock (Highest stock first) - priority to clear
        return unsold.sort((a, b) => b.stock - a.stock).slice(0, 5);
    }, [products, sales]);

    return (
        <Card className={cn("glass-panel border-slate-200/50 dark:border-slate-800/50 shadow-none lg:col-span-1 h-full", className)}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                    <CardTitle className="flex items-center gap-2 text-foreground font-medium tracking-wide">
                        <PackageX className="h-5 w-5 text-amber-500" />
                        Itens Sem Vendas (Dead Stock)
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-1">
                        Top 5 produtos estagnados (maior stock).
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full bg-slate-800" />)}
                    </div>
                ) : deadStockProducts.length > 0 ? (
                    deadStockProducts.map((product, index) => (
                        <div key={product.id} className="group">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-sm font-medium text-muted-foreground truncate" title={product.name}>
                                    {product.name}
                                </span>
                                <span className="text-sm font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    {formatCompactNumber(product.stock)} {product.unit}
                                </span>
                            </div>

                            {/* Progress bar relative to the highest stock item in the list */}
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-1000 ease-out bg-amber-500")}
                                    style={{
                                        // Calculate percentage relative to the item with most stock in this list
                                        width: `${(product.stock / deadStockProducts[0].stock) * 100}%`
                                    }}
                                />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">Ótimo! Todos os produtos têm registo de vendas.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
