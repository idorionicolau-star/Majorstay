"use client"

import { ReservedBadge } from "./reserved-dialog";
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table"
import { Product, Location } from "@/lib/types"
import { AlertCircle, MapPin, History, Trash2, Edit2 } from "lucide-react"
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { AuditStockDialog } from "./audit-stock-dialog"
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ColumnsOptions {
  onAttemptDelete: (product: Product) => void;
  onProductUpdate: (product: Product) => void;
  canEdit: boolean;
  isMultiLocation: boolean;
  locations: Location[];
  isReadOnly?: boolean;
}

export const getStockStatus = (product: Product) => {
  const availableStock = product.stock - product.reservedStock;
  if (availableStock <= 0) {
    return "sem-estoque";
  }
  if (availableStock <= product.criticalStockThreshold) {
    return "critico";
  }
  if (availableStock <= product.lowStockThreshold) {
    return "baixo";
  }
  return "bom";
};

export const columns = (options: ColumnsOptions): ColumnDef<Product>[] => {
  const { canEdit, isMultiLocation, locations, isReadOnly } = options;

  const baseColumns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Material",
      cell: ({ row }) => (
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-[800] text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
              {row.original.name}
              {(row.original.cost === undefined || row.original.cost <= 0) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Produto sem custo registado. O lucro reportado será de 100%.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">ID: {row.original.id?.toUpperCase().substring(0, 6)}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Categoria",
      cell: ({ row }) => (
        <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
          {row.original.category}
        </span>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
  ];

  if (isMultiLocation) {
    baseColumns.push({
      accessorKey: "location",
      header: "Localização",
      cell: ({ row }) => {
        const locationName = locations.find(l => l.id === row.original.location)?.name || row.original.location || "N/A";
        return (
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">{locationName}</span>
          </div>
        );
      },
    });
  }

  baseColumns.push(
    {
      accessorKey: "stock",
      header: "Disponível",
      cell: ({ row }) => {
        const status = getStockStatus(row.original);
        const availableStock = row.original.stock - row.original.reservedStock;
        return (
          <div className="text-center">
            <span className={cn("text-base font-black",
              status === 'critico' || status === 'sem-estoque' ? 'text-destructive' :
                status === 'baixo' ? 'text-[hsl(var(--chart-4))]' :
                  'text-foreground'
            )}>
              {availableStock}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "reservedStock",
      header: "Reservado",
      cell: ({ row }) => {
        const reserved = row.original.reservedStock;
        return (
          <div className="text-center">
            {reserved > 0
              ? <ReservedBadge product={row.original} className="cursor-pointer text-base font-black text-primary underline decoration-dotted underline-offset-4">{reserved}</ReservedBadge>
              : <span className="text-base font-black text-primary">-</span>}
          </div>
        );
      },
    },
    {
      accessorKey: "restock",
      header: "Reposição",
      cell: ({ row }) => {
        const p = row.original;
        const available = p.stock - p.reservedStock;

        // Utilize the Target Stock designated by the Python AI Prediction, otherwise fallback
        let targetStock = p.targetStock || (p.lowStockThreshold * 2);

        // Minimum target shouldn't be zero, and should at least clear the low threshold
        targetStock = Math.max(targetStock, p.lowStockThreshold + 1);

        const needed = targetStock - available;
        const isLow = available <= p.lowStockThreshold;

        if (!isLow || needed <= 0) {
          return <div className="text-center text-muted-foreground">-</div>;
        }

        return (
          <div className="text-center">
            <span className="text-[10px] font-black px-2.5 py-1.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              +{needed} un.
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "lastUpdated",
      header: "Estado",
      cell: ({ row }) => {
        const status = getStockStatus(row.original);
        if (status === 'critico' || status === 'sem-estoque') {
          return <div className="inline-flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-destructive/20">
            <AlertCircle size={14} strokeWidth={3} /> {status === 'sem-estoque' ? 'Esgotado' : 'Crítico'}
          </div>
        }
        if (status === 'baixo') {
          return <div className="inline-flex items-center gap-2 text-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[hsl(var(--chart-4))]/20">
            <AlertCircle size={14} strokeWidth={3} /> Baixo
          </div>
        }
        return <div className="inline-flex items-center gap-2 text-[hsl(var(--chart-2))] bg-[hsl(var(--chart-2))]/10 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[hsl(var(--chart-2))]/20">
          Estável
        </div>
      }
    }
  );

  baseColumns.push({
    id: "actions",
    cell: ({ row }) => {
      const product = row.original
      return (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon" className="p-3 h-auto w-auto text-muted-foreground hover:text-primary rounded-xl transition-all">
                  <Link href={`/inventory/history?productName=${encodeURIComponent(product.name)}`}>
                    <History className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Ver Histórico</p></TooltipContent>
            </Tooltip>
            {canEdit && (
              <>
                <AuditStockDialog product={product} trigger="icon" disabled={isReadOnly} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    {isReadOnly ? (
                      <Button disabled variant="ghost" size="icon" className="p-3 h-auto w-auto text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">
                        <Edit2 className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                    ) : (
                      <Button asChild variant="ghost" size="icon" className="p-3 h-auto w-auto text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">
                        <Link href={`/inventory/${product.instanceId || product.id}/edit`}>
                          <Edit2 className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Link>
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isReadOnly ? "Indisponível em modo leitura" : "Editar Produto"}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => options.onAttemptDelete(product)}
                      disabled={isReadOnly}
                      className="p-3 h-auto w-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Apagar</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isReadOnly ? "Indisponível em modo leitura" : "Apagar Produto"}</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </TooltipProvider>
        </div>
      )
    },
  });

  return baseColumns;
}
