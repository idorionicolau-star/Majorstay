"use client";

import { useState, useContext, useMemo } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function RecycleBin() {
    const { allProducts: products, allSales: sales, allOrders: orders, allProductions: productions, allCatalogProducts: catalog, restoreItem, hardDelete, user, confirmAction } = useContext(InventoryContext) || { allProducts: [], allSales: [], allOrders: [], allProductions: [], allCatalogProducts: [] };
    const [searchQuery, setSearchQuery] = useState('');


    // We need to fetch *deleted* items.
    // However, the context's `products` and `sales` usually Filter Out deleted items?
    // If I changed the types to include `deletedAt`, I need to check if the main hooks filter them out.
    // Usually `useCollection` fetches everything unless I put a query constraint.
    // If I didn't update the hooks in `InventoryContext`, they are fetching everything.
    // So I need to filter locally.
    // BUT, usually we WANT to filter them out from the main UI (Inventory Table).
    // The main UI probably iterates `products` directly.
    // So if `products` contains deleted items, they show up in Inventory.
    // I need to check `InventoryContext` fetching logic.
    // If `useCollection` gets everything, I should filter `products` exported in context to NOT include deleted.
    // AND have a separate `deletedProducts` or expose `allProducts`?
    // OR, I just filter here for `p.deletedAt` and filter in InventoryPage for `!p.deletedAt`.

    // Assumption: The main context exports `products` as Raw from useCollection (or memoized).
    // I need to verify this behavior.

    // Let's assume for now they are all in `products` / `sales`.

    const deletedProducts = useMemo(() => {
        return products?.filter(p => p.deletedAt) || [];
    }, [products]);

    const deletedSales = useMemo(() => {
        return sales?.filter(s => s.deletedAt) || [];
    }, [sales]);

    const deletedOrders = useMemo(() => {
        return orders?.filter(o => o.deletedAt) || [];
    }, [orders]);

    const deletedProductions = useMemo(() => {
        return productions?.filter(p => p.deletedAt) || [];
    }, [productions]);

    const deletedCatalog = useMemo(() => (catalog || []).filter((p: any) => p.deletedAt), [catalog]);
    const filteredCatalog = deletedCatalog.filter((p: any) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const filteredProducts = deletedProducts.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredSales = deletedSales.filter(s =>
        (s.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.guideNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredOrders = deletedOrders.filter(o =>
        (o.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.clientName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredProductions = deletedProductions.filter(p =>
        (p.productName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRestore = async (item: { id: string, name: string, type: 'product' | 'sale' | 'order' | 'production' | 'catalog' }) => {
        if (!restoreItem) return;

        if (window.confirm(`Tem a certeza que deseja restaurar "${item.name}"?`)) {
            let collection = '';
            switch (item.type) {
                case 'product': collection = 'products'; break;
                case 'sale': collection = 'sales'; break;
                case 'order': collection = 'orders'; break;
                case 'production': collection = 'productions'; break;
                case 'catalog': collection = 'catalogProducts'; break;
            }
            if (collection) {
                await restoreItem(collection, item.id);
            }
        }
    };

    const handleHardDelete = async (item: { id: string, name: string, type: 'product' | 'sale' | 'order' | 'production' | 'catalog' }) => {
        if (!hardDelete) return;

        const performDelete = async () => {
            let collection = '';
            switch (item.type) {
                case 'product': collection = 'products'; break;
                case 'sale': collection = 'sales'; break;
                case 'order': collection = 'orders'; break;
                case 'production': collection = 'productions'; break;
                case 'catalog': collection = 'catalogProducts'; break;
            }
            if (collection) {
                await hardDelete(collection, item.id);
            }
        };

        if (confirmAction) {
            confirmAction(
                performDelete,
                "Apagar Permanentemente",
                `ATENÇÃO: Tem a certeza que deseja apagar "${item.name}" PERMANENTEMENTE? Esta ação NÃO pode ser desfeita.`
            );
        } else {
            // Fallback
            if (window.confirm(`ATENÇÃO: Tem a certeza que deseja apagar PERMANENTEMENTE "${item.name}"? Esta ação NÃO pode ser desfeita.`)) {
                await performDelete();
            }
        }
    };

    if (!user || user.role !== 'Admin') return <div className="p-4 text-center text-muted-foreground">Acesso restrito a administradores.</div>;

    return (
        <Card className="border-red-200 dark:border-red-900 bg-red-50/20">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-500" />
                            Lixeira (Recycle Bin)
                        </CardTitle>
                        <CardDescription>
                            Recupere itens apagados ou remova-os permanentemente.
                        </CardDescription>
                    </div>
                </div>
                <div className="mt-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Procurar itens apagados..."
                            className="pl-9 sm:pl-9 bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />

                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="products">
                    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
                        <TabsTrigger value="products">Produtos ({deletedProducts.length})</TabsTrigger>
                        <TabsTrigger value="sales">Vendas ({deletedSales.length})</TabsTrigger>
                        <TabsTrigger value="orders">Encomendas ({deletedOrders.length})</TabsTrigger>
                        <TabsTrigger value="production">Produção ({deletedProductions.length})</TabsTrigger>
                        <TabsTrigger value="catalog">Catálogo ({deletedCatalog.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="products">
                        <ScrollArea className="h-[300px] border rounded-md bg-background">
                            {filteredProducts.length === 0 ? (
                                <p className="text-center p-4 text-muted-foreground text-sm">Nenhum produto na lixeira.</p>
                            ) : (
                                <div className="divide-y">
                                    {filteredProducts.map(product => (
                                        <div key={product.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                                            <div>
                                                <p className="font-medium text-sm">{product.name}</p>
                                                <p className="text-xs text-muted-foreground">Apagado a: {product.deletedAt ? format(new Date(product.deletedAt), "dd/MM/yyyy HH:mm", { locale: pt }) : 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">Por: {product.deletedBy || 'Desconhecido'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleRestore({ id: product.id || product.instanceId, name: product.name, type: 'product' })} title="Restaurar">
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleHardDelete({ id: product.id || product.instanceId, name: product.name, type: 'product' })} title="Apagar Permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="catalog">
                        <ScrollArea className="h-[300px] border rounded-md bg-background">
                            {filteredCatalog.length === 0 ? (
                                <p className="text-center p-4 text-muted-foreground text-sm">Nenhum produto do catálogo na lixeira.</p>
                            ) : (
                                <div className="divide-y">
                                    {filteredCatalog.map((product: any) => (
                                        <div key={product.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                                            <div>
                                                <p className="font-medium text-sm">{product.name}</p>
                                                <p className="text-xs text-muted-foreground">{product.category} · apagado a {product.deletedAt ? format(new Date(product.deletedAt), "dd/MM/yyyy HH:mm", { locale: pt }) : 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">Por: {product.deletedBy || 'Desconhecido'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleRestore({ id: product.id, name: product.name, type: 'catalog' })} title="Restaurar">
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleHardDelete({ id: product.id, name: product.name, type: 'catalog' })} title="Apagar Permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="sales">
                        <ScrollArea className="h-[300px] border rounded-md bg-background">
                            {filteredSales.length === 0 ? (
                                <p className="text-center p-4 text-muted-foreground text-sm">Nenhuma venda na lixeira.</p>
                            ) : (
                                <div className="divide-y">
                                    {filteredSales.map(sale => (
                                        <div key={sale.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                                            <div>
                                                <p className="font-medium text-sm">Venda #{sale.guideNumber || 'N/A'} - {sale.productName}</p>
                                                <p className="text-xs text-muted-foreground">Apagado a: {sale.deletedAt ? format(new Date(sale.deletedAt), "dd/MM/yyyy HH:mm", { locale: pt }) : 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">Por: {sale.deletedBy || 'Desconhecido'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleRestore({ id: sale.id, name: `Venda ${sale.guideNumber}`, type: 'sale' })} title="Restaurar">
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleHardDelete({ id: sale.id, name: `Venda ${sale.guideNumber}`, type: 'sale' })} title="Apagar Permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="orders">
                        <ScrollArea className="h-[300px] border rounded-md bg-background">
                            {filteredOrders.length === 0 ? (
                                <p className="text-center p-4 text-muted-foreground text-sm">Nenhuma encomenda na lixeira.</p>
                            ) : (
                                <div className="divide-y">
                                    {filteredOrders.map(order => (
                                        <div key={order.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                                            <div>
                                                <p className="font-medium text-sm">{order.clientName} - {order.productName}</p>
                                                <p className="text-xs text-muted-foreground">Apagado a: {order.deletedAt ? format(new Date(order.deletedAt), "dd/MM/yyyy HH:mm", { locale: pt }) : 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">Por: {order.deletedBy || 'Desconhecido'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleRestore({ id: order.id, name: `Encomenda de ${order.clientName}`, type: 'order' })} title="Restaurar">
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleHardDelete({ id: order.id, name: `Encomenda de ${order.clientName}`, type: 'order' })} title="Apagar Permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="production">
                        <ScrollArea className="h-[300px] border rounded-md bg-background">
                            {filteredProductions.length === 0 ? (
                                <p className="text-center p-4 text-muted-foreground text-sm">Nenhum registo de produção na lixeira.</p>
                            ) : (
                                <div className="divide-y">
                                    {filteredProductions.map(prod => (
                                        <div key={prod.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                                            <div>
                                                <p className="font-medium text-sm">{prod.productName} ({prod.quantity})</p>
                                                <p className="text-xs text-muted-foreground">Apagado a: {prod.deletedAt ? format(new Date(prod.deletedAt), "dd/MM/yyyy HH:mm", { locale: pt }) : 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">Por: {prod.deletedBy || 'Desconhecido'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleRestore({ id: prod.id, name: `Produção de ${prod.productName}`, type: 'production' })} title="Restaurar">
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleHardDelete({ id: prod.id, name: `Produção de ${prod.productName}`, type: 'production' })} title="Apagar Permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>


        </Card>
    );
}
