"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Production } from "@/lib/types"
import { Trash2 } from "lucide-react"
import { Button } from "../ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
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
} from "@/components/ui/alert-dialog"

interface ColumnsOptions {
  onDeleteProduction: (id: string) => void;
  canEdit: boolean;
}

export const columns = (options: ColumnsOptions): ColumnDef<Production>[] => {
  const { onDeleteProduction, canEdit } = options;

  const baseColumns: ColumnDef<Production>[] = [
    {
      accessorKey: "productName",
      header: "Produto Fabricado",
    },
    {
      accessorKey: "quantity",
      header: "Quantidade",
    },
    {
      accessorKey: "date",
      header: "Data",
      cell: ({ row }) => {
        return new Date(row.original.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      }
    },
    {
      accessorKey: "registeredBy",
      header: "Registrado por",
    }
  ];

  if (canEdit) {
    baseColumns.push({
      id: "actions",
      cell: ({ row }) => {
        const production = row.original;
        const isTransferred = production.status === 'Transferido';

        if (isTransferred) return null;

        return (
          <div className="flex items-center justify-end">
            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Apagar Produção</span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Apagar Produção</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá mover o registo de produção para a lixeira.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeleteProduction(production.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Apagar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      }
    });
  }

  return baseColumns;
}
