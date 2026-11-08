
"use client"

import { saleMoment } from "@/lib/sale-time";
import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Sale, Company } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Edit, Printer, FileSearch, CheckCircle, PackageCheck, Download, DollarSign, Mail, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { EditSaleDialog } from "./edit-sale-dialog"
import { openSale } from "./sale-sheet"
import { paidInFull } from "./use-sale-actions"
import { useSaleDocument } from "./use-sale-document"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import {
    Dialog,
    DialogTrigger,
} from "@/components/ui/dialog"

import { InventoryContext } from "@/context/inventory-context"
import { cn } from "@/lib/utils"



interface ColumnsOptions {
    onUpdateSale: (sale: Sale) => void;
    onConfirmPickup: (sale: Sale) => void;
    onDeleteSale: (saleId: string) => void;
    canEdit: boolean;
}

const ActionsCell = ({ row, options }: { row: any, options: ColumnsOptions }) => {
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const sale = row.original as Sale;
    const { canEdit } = options;
    const inventoryContext = React.useContext(InventoryContext);
    const isManagerUser = inventoryContext?.user?.role === 'Admin' || inventoryContext?.user?.role === 'Dono';
    const { customer, sendReceipt: handleSendReceipt, download: handleDownload, print: handlePrint } = useSaleDocument(sale);

    return (
        <div className="flex items-center justify-end gap-1" data-tour="sales-actions">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSale(sale.id)}>
                            <FileSearch className="h-4 w-4" />
                            <span className="sr-only">Ver Detalhes</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Ver Detalhes</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {sale.status === 'Pago' && canEdit && !sale.orderId && sale.documentType !== 'Encomenda' && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500" onClick={() => options.onConfirmPickup(sale)}>
                                <CheckCircle className="h-4 w-4" />
                                <span className="sr-only">Confirmar Levantamento</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Confirmar Levantamento</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            {canEdit && (
                <>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditDialogOpen(true)}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Editar Venda</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Editar Venda</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <EditSaleDialog
                        sale={sale}
                        onUpdateSale={options.onUpdateSale}
                        onOpenChange={setIsEditDialogOpen}
                        open={isEditDialogOpen}
                    />
                </>
            )}

            {canEdit && (sale.amountPaid || 0) < sale.totalValue && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600"
                                onClick={() => options.onUpdateSale(paidInFull(sale))}
                            >
                                <DollarSign className="h-4 w-4" />
                                <span className="sr-only">Confirmar Pagamento Total</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Confirmar Pagamento Total</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            {customer && customer.email && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-600" onClick={handleSendReceipt}>
                                <Mail className="h-4 w-4" />
                                <span className="sr-only">Enviar Recibo por Email</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Enviar Recibo para {customer.email}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Baixar Documento</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Baixar {sale.documentType} como PDF</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrint}>
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">Imprimir Documento</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Imprimir {sale.documentType}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {canEdit && isManagerUser && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                    if (inventoryContext?.confirmAction) {
                        inventoryContext.confirmAction(async () => {
                            options.onDeleteSale(sale.id!);
                        }, "Apagar Venda", `Tem a certeza que deseja apagar a venda ${sale.documentType} #${sale.guideNumber}? Esta ação moverá a venda para a lixeira e reporá o stock.`);
                    } else {
                        // Fallback if context missing (should not happen)
                        if (window.confirm("Tem a certeza que deseja apagar esta venda?")) {
                            options.onDeleteSale(sale.id!);
                        }
                    }
                }}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Apagar Venda</span>
                </Button>
            )}
        </div>
    )
}

export { ActionsCell as SaleActions };

export const columns = (options: ColumnsOptions): ColumnDef<Sale>[] => {

    const baseColumns: ColumnDef<Sale>[] = [
        {
            accessorKey: "guideNumber",
            header: "Documento N.º",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold">{row.original.guideNumber}</span>
                    <span className="text-xs text-muted-foreground">{row.original.documentType}</span>
                    {row.original.offlinePending && (
                        <span className="mt-0.5 w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Provisório · por numerar</span>
                    )}
                    {!row.original.offlinePending && row.original.provisionalNumber && (
                        <span className="text-[10px] text-muted-foreground">antes: {row.original.provisionalNumber}</span>
                    )}
                </div>
            )
        },
        {
            accessorKey: "clientName",
            header: "Cliente",
            cell: ({ row }) => row.original.clientName || <span className="text-muted-foreground italic">N/A</span>
        },
        {
            accessorKey: "productName",
            header: "Produto",
        },
        {
            accessorKey: "totalValue",
            header: "Valor Total",
            cell: ({ row }) => {
                const sale = row.original;
                const isPartiallyPaid = sale.amountPaid !== undefined && sale.amountPaid < sale.totalValue;
                return (
                    <div className="text-right">
                        <div className="font-medium">{formatCurrency(sale.totalValue)}</div>
                        {isPartiallyPaid && (
                            <div className="text-xs text-amber-600">
                                ({formatCurrency(sale.amountPaid || 0)} pagos)
                            </div>
                        )}
                    </div>
                )
            }
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status;
                return (
                    <div className={cn("inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold",
                        status === 'Levantado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                    )}>
                        {status === 'Levantado' ? <CheckCircle className="h-3 w-3" /> : <PackageCheck className="h-3 w-3" />}
                        {status}
                    </div>
                )
            }
        },
        {
            accessorKey: "date",
            header: "Data",
            cell: ({ row }) => {
                const m = saleMoment(row.original);
                return (
                    <div className="leading-tight">
                        <div>{m.day}</div>
                        {m.time && <div className="text-xs text-muted-foreground tabular-nums">{m.time}</div>}
                    </div>
                );
            }
        },
        {
            id: "actions",
            cell: (props) => <ActionsCell {...props} options={options} />,
        }
    ];

    return baseColumns;
}
