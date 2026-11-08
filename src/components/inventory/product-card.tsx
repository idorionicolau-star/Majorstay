"use client";
import { ProductPhoto } from "@/components/ui/product-photo";

import type { Product, Location } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Trash2, PackageCheck, History, Edit2, MoreHorizontal, FileText } from "lucide-react";
import { getStockStatus } from "./columns";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AuditStockDialog } from "./audit-stock-dialog";
import { ReservedBadge } from "./reserved-dialog";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductCardProps {
    product: Product;
    onProductUpdate: (product: Product) => void;
    onAttemptDelete: (product: Product) => void;
    viewMode?: 'normal' | 'condensed';
    canEdit: boolean;
    locations: Location[];
    isMultiLocation: boolean;
    locationName?: string;
}

export function ProductCard({ product, onProductUpdate, onAttemptDelete, viewMode = 'normal', canEdit, locations, isMultiLocation }: ProductCardProps) {
    const status = getStockStatus(product);

    const statusInfo = {
        bom: "text-[hsl(var(--chart-2))]",
        baixo: "text-[hsl(var(--chart-4))]",
        critico: "text-destructive",
        'sem-estoque': "text-destructive",
    }

    const isCondensed = viewMode === 'condensed';
    const availableStock = product.stock - product.reservedStock;

    return (
        <Card data-tour="inv-card" className="glass-card flex flex-col h-full group p-2 sm:p-4 shadow-sm">
            {/* Sem foto não ocupa meio cartão com um "Sem foto" — só mostra quando existe. */}
            {product.imageUrl && (
                <ProductPhoto src={product.imageUrl} alt={product.name} className="w-full h-32 mb-2 rounded-md shrink-0" />
            )}
            <CardHeader className="p-1 sm:p-2">
                <CardTitle className="text-sm font-bold leading-tight line-clamp-2" title={product.name}>{product.name}</CardTitle>
                <div className={cn("mt-1", isCondensed && "hidden")}>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 border-0">{product.category}</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 p-1 sm:p-2">
                <div data-tour="inv-stock" className={cn(
                    "flex items-baseline justify-center text-center py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50",
                    isCondensed ? "flex-col" : ""
                )}>
                    <span className={cn("font-black", statusInfo[status], isCondensed ? "text-xl" : "text-3xl")}>{availableStock}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">/{product.unit || 'un'}</span>
                </div>
                {product.reservedStock > 0 && (
                    <ReservedBadge product={product} className="flex items-center justify-center gap-1.5 text-xs text-primary font-semibold cursor-pointer hover:underline">
                        <PackageCheck className="h-3 w-3" />
                        <span>{product.reservedStock} reservado{product.reservedStock === 1 ? "" : "s"}</span>
                    </ReservedBadge>
                )}
                <div className="text-center">
                    <p className={cn("font-medium text-muted-foreground", isCondensed ? "text-xs" : "text-sm")}>{formatCurrency(product.price)}</p>
                    {(product.cost === undefined || product.cost <= 0) && (
                        canEdit ? (
                            <Link href={`/inventory/${product.instanceId || product.id}/edit`} className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                                sem custo — preencher
                            </Link>
                        ) : (
                            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">sem custo</p>
                        )
                    )}
                </div>
                {status !== 'bom' && !isCondensed && (
                    <div className={cn(
                        "inline-flex items-center justify-center w-full gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                        status === 'baixo' && 'text-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10 border-[hsl(var(--chart-4))]/20',
                        (status === 'critico' || status === 'sem-estoque') && 'text-destructive bg-destructive/10 border-destructive/20'
                    )}>
                        <AlertCircle size={12} strokeWidth={3} />
                        {status === 'sem-estoque' ? 'Esgotado' : status === 'critico' ? 'Crítico' : 'Baixo'}
                    </div>
                )}
            </CardContent>
            <CardFooter data-tour="inv-card-actions" className="flex justify-center gap-1.5 sm:gap-2 p-1 sm:p-2 pt-2">
                <TooltipProvider>
                    {canEdit ? (
                        <>
                            <AuditStockDialog product={product} trigger="card-button" />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant="outline" size="icon" className="flex-1 h-9">
                                        <Link href={`/inventory/${product.instanceId || product.id}/edit`}>
                                            <Edit2 className="h-4 w-4" />
                                            <span className="sr-only">Editar</span>
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Editar Produto</p></TooltipContent>
                            </Tooltip>
                            {/* Apagar fica dentro do menu — longe de um toque sem querer. */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="flex-1 h-9">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Mais opções</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/catalog?produto=${encodeURIComponent(product.name)}`}>
                                            <FileText className="mr-2 h-4 w-4" /> Ficha (preço e vendas)
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/inventory/history?productName=${encodeURIComponent(product.name)}`}>
                                            <History className="mr-2 h-4 w-4" /> Ver histórico
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => onAttemptDelete(product)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Apagar produto
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button asChild variant="outline" size="icon" className="flex-1 h-9">
                                    <Link href={`/inventory/history?productName=${encodeURIComponent(product.name)}`}>
                                        <History className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Ver Histórico</p></TooltipContent>
                        </Tooltip>
                    )}
                </TooltipProvider>
            </CardFooter>
        </Card>
    );
}
