
"use client";

import { useContext, useMemo } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { links } from "@/lib/deep-links";

export function InventoryAlerts() {
    const { products, loading } = useContext(InventoryContext) || { products: [], loading: true };

    const lowStockProducts = useMemo(() => {
        if (!products) return [];

        return products
            .filter(p => {
                const availableStock = p.stock - p.reservedStock;
                return availableStock <= 5;
            })
            .sort((a, b) => (a.stock - a.reservedStock) - (b.stock - b.reservedStock))
            .slice(0, 6); // Top 6 most critical
    }, [products]);

    if (loading || lowStockProducts.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-bold font-headline">Atenção no Inventário</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockProducts.map((product) => {
                    const availableStock = Math.max(0, product.stock - product.reservedStock);
                    const isCritical = availableStock <= 2;

                    return (
                        <Link
                            key={product.instanceId}
                            href={links.product(product.name, product.location)}
                            className="group"
                        >
                            <Card className={cn(
                                "relative overflow-hidden transition-all duration-300 hover:shadow-md border-l-4",
                                isCritical ? "border-l-destructive bg-destructive/5" : "border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/5"
                            )}>
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                                            {product.name}
                                        </CardTitle>
                                        <Badge className={cn(
                                            "text-[10px] uppercase font-black px-1.5 py-0 border-none",
                                            isCritical ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-amber-500 text-white hover:bg-amber-600"
                                        )}>
                                            {isCritical ? "Crítico" : "Baixo"}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 flex items-center justify-between">
                                    <div className="flex items-baseline gap-1">
                                        <span className={cn(
                                            "text-2xl font-black",
                                            isCritical ? "text-destructive" : "text-amber-600 dark:text-amber-500"
                                        )}>
                                            {Math.floor(availableStock)}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-medium">
                                            {product.unit || 'un.'}
                                        </span>
                                    </div>

                                    <div className={cn(
                                        "p-2 rounded-full",
                                        isCritical ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"
                                    )}>
                                        {isCritical ? <AlertCircle className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
