
import { useContext, useMemo, useState } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Download, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { links } from "@/lib/deep-links";
import { isCountableSale } from '@/lib/sale-filters';

export function StockAlerts({ className }: { className?: string }) {
    const { products, sales, loading, companyData } = useContext(InventoryContext) || { products: [], sales: [], loading: true, companyData: null };
    const [currentPage, setCurrentPage] = useState(1);
    const [isDownloading, setIsDownloading] = useState(false);
    const { toast } = useToast();

    const ITEMS_PER_PAGE = 5;

    const criticalStockProducts = useMemo(() => {
        if (!products || !sales) return [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const productSalesVelocity = new Map<string, number>();
        sales.forEach(s => {
            // As vendas guardam a data em `date` (ISO). Antes lia-se `timestamp`, que não existe,
            // por isso nenhuma venda contava e TODOS os itens apareciam como "Sem giro recente".
            const raw: any = (s as any).date ?? (s as any).timestamp;
            const saleDate = raw?.toDate ? raw.toDate() : new Date(raw);
            if (!isNaN(saleDate.getTime()) && saleDate >= thirtyDaysAgo && isCountableSale(s)) {
                const current = productSalesVelocity.get(s.productName) || 0;
                productSalesVelocity.set(s.productName, current + (s.quantity || 0));
            }
        });

        return products
            .filter(p => {
                const availableStock = p.stock - p.reservedStock;
                return availableStock <= p.criticalStockThreshold;
            })
            .map(p => {
                const totalSold30d = productSalesVelocity.get(p.name) || 0;
                const ads = totalSold30d / 30;
                const availableStock = p.stock - p.reservedStock;
                const daysOfStock = ads > 0 ? Math.floor(availableStock / ads) : Infinity;

                return {
                    ...p,
                    ads,
                    daysOfStock
                };
            })
            // Primeiro os que acabam mais depressa; depois os esgotados; por fim os sem vendas.
            .sort((a, b) => (a.daysOfStock - b.daysOfStock) || ((a.stock - a.reservedStock) - (b.stock - b.reservedStock)));

    }, [products, sales]);

    // Reset to page 1 if data changes significantly
    useMemo(() => {
        setCurrentPage(1);
    }, [criticalStockProducts.length]);

    const handleDownloadCriticalStock = async () => {
        if (criticalStockProducts.length === 0) return;
        setIsDownloading(true);
        if (!companyData) {
            toast({ variant: "destructive", title: "Erro", description: "Dados da empresa não encontrados." });
            setIsDownloading(false);
            return;
        }

        try {
            const { generateCriticalStockPDF } = await import('@/lib/pdf-generator');
            await generateCriticalStockPDF(criticalStockProducts as any, companyData);
            toast({ title: "Relatório gerado", description: "Relatório de stock crítico gerado com sucesso!" });
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            toast({ variant: "destructive", title: "Erro", description: "Erro ao gerar o relatório PDF." });
        } finally {
            setIsDownloading(false);
        }
    };

    const totalPages = Math.ceil(criticalStockProducts.length / ITEMS_PER_PAGE);
    const displayProducts = criticalStockProducts.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(p => p - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(p => p + 1);
    };

    if (loading) {
        return (
            <Card className="bg-transparent border-none">
                <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-slate-800" />
                    <Skeleton className="h-4 w-1/2 bg-slate-800" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full bg-slate-800" />)}
                </CardContent>
            </Card>
        );
    }

    if (criticalStockProducts.length === 0) {
        return (
            <Card className={cn("glass-panel border-slate-200/50 dark:border-slate-800/50 shadow-none flex flex-col justify-center items-center h-full", className)}>
                <CardHeader className="items-center">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                        <CheckCircle2 className="text-emerald-500" strokeWidth={1.5} />
                        Alertas de Stock
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Nenhum alerta crítico.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("glass-panel border-red-500/20 dark:border-red-900/40 shadow-[0_0_20px_rgba(220,38,38,0.1)] h-full flex flex-col", className)}>
            <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <AlertTriangle className="text-red-500" strokeWidth={2} />
                            Stock Crítico
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                Atenção imediata necessária.
                            </span>
                        </CardDescription>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                                    onClick={handleDownloadCriticalStock}
                                    disabled={isDownloading}
                                >
                                    <Download className={cn("h-4 w-4", isDownloading && "animate-pulse")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover text-popover-foreground border-border">
                                <p>Baixar Relatório</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow md:overflow-auto">
                {displayProducts.map(product => {
                    const availableStock = product.stock - product.reservedStock;

                    return (
                        <Link
                            href={links.product(product.name, product.location)}
                            key={product.id}
                            className="block group"
                        >
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 group-hover:border-red-500/30 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 shadow-sm dark:shadow-none">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-foreground transition-colors truncate mr-2">{product.name}</span>
                                    <span className={cn("text-[10px] font-semibold mt-0.5", availableStock <= 0 ? "text-red-500" : product.daysOfStock !== Infinity ? "text-amber-500" : "text-muted-foreground")}>
                                        {availableStock <= 0
                                            ? "Esgotado — produzir ou dar entrada"
                                            : product.daysOfStock !== Infinity
                                                ? `Acaba em ~${product.daysOfStock} dias ao ritmo actual`
                                                : "Abaixo do mínimo · sem vendas registadas em 30 dias"}
                                    </span>
                                </div>
                                <div className="text-right flex items-center gap-2 shrink-0">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_5px_currentColor]" />
                                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                                        {Number.isInteger(availableStock) ? Math.max(0, availableStock) : Math.max(0, availableStock).toFixed(1)} <span className="text-[10px] text-muted-foreground font-normal">{product.unit || 'un'}</span>
                                    </span>
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="pt-2 pb-4 shrink-0 flex items-center justify-between border-t border-border/40 mt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
