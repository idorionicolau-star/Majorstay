
'use client';

import { useContext, useMemo } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Package } from 'lucide-react';

export function LeastSoldProducts() {
    const { products, sales, loading } = useContext(InventoryContext) || { products: [], sales: [], loading: true };

    const unsoldProducts = useMemo(() => {
        if (!products || !sales) return [];

        const soldProductNames = new Set(sales.map(sale => sale.productName));
        
        const unsoldMap = new Map<string, {name: string, totalStock: number, unit: string | undefined }>();

        for (const product of products) {
            if (!soldProductNames.has(product.name)) {
                const availableStock = product.stock - product.reservedStock;
                if (availableStock > 0) {
                    const existing = unsoldMap.get(product.name);
                    if (existing) {
                        existing.totalStock += availableStock;
                    } else {
                        unsoldMap.set(product.name, { name: product.name, totalStock: availableStock, unit: product.unit });
                    }
                }
            }
        }
        
        return Array.from(unsoldMap.values())
            .sort((a, b) => b.totalStock - a.totalStock) // Show highest stock first
            .slice(0, 5); // Limit to top 5 for the dashboard

    }, [products, sales]);

    return (
        <Card className="glass-card">
            <CardHeader>
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                    <AlertTriangle className="text-chart-3" />
                    Produtos Sem Vendas
                </CardTitle>
                <CardDescription>
                    Itens com stock que nunca foram vendidos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-4 w-1/4" />
                            </div>
                        ))}
                    </div>
                ) : unsoldProducts.length > 0 ? (
                    <div className="space-y-3">
                        {unsoldProducts.map(product => (
                            <div key={product.name} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-sm font-semibold truncate" title={product.name}>{product.name}</p>
                                </div>
                                <p className="text-sm font-bold">{product.totalStock} <span className="text-xs text-muted-foreground">{product.unit || 'un.'}</span></p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Todos os produtos em stock têm registo de venda.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
