"use client";

// A ficha de uma venda: os detalhes e tudo o que se pode fazer com ela (corrigir a data ou o cliente, receber,
// levantar, imprimir, apagar). Abre-se de qualquer página com `openSale(id)` — Financeiro, Clientes, Relatórios… —
// para nunca ser preciso ir ao Histórico de Vendas só para corrigir uma venda.
import { useContext, useState, useSyncExternalStore } from "react";
import { Calendar, CheckCircle, DollarSign, Download, Edit, Mail, MapPin, Package, Printer, Trash2, User, UserCheck } from "lucide-react";
import type { Sale } from "@/lib/types";
import { InventoryContext } from "@/context/inventory-context";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { formatSaleMoment } from "@/lib/sale-time";
import { EditSaleDialog } from "./edit-sale-dialog";
import { paidInFull, useSaleActions } from "./use-sale-actions";
import { useSaleDocument } from "./use-sale-document";

let openId: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

/** Abre a ficha desta venda por cima da página onde se está. */
export function openSale(id: string) {
    openId = id;
    emit();
}

export function closeSale() {
    openId = null;
    emit();
}

/** Montado uma vez no esqueleto da app. */
export function SaleSheetHost() {
    const id = useSyncExternalStore(subscribe, () => openId, () => null);
    const inventoryContext = useContext(InventoryContext);
    // a venda vem sempre da lista viva: depois de uma correcção, a ficha mostra logo os valores novos
    const sale = id ? (inventoryContext?.sales || []).find((s) => s.id === id && !s.deletedAt) : undefined;
    if (!sale) return null;
    return <SaleSheet key={sale.id} sale={sale} />;
}

function SaleSheet({ sale }: { sale: Sale }) {
    const inventoryContext = useContext(InventoryContext);
    const { updateSale, confirmPickup, removeSale, canEditSales } = useSaleActions();
    const { customer, sendReceipt, download, print } = useSaleDocument(sale);
    const [editing, setEditing] = useState(false);

    const isManager = inventoryContext?.user?.role === "Admin" || inventoryContext?.user?.role === "Dono";
    const paid = sale.amountPaid ?? sale.totalValue;
    const owed = sale.totalValue - paid;
    const canPickup = canEditSales && sale.status === "Pago" && !sale.orderId && sale.documentType !== "Encomenda";
    const locationName = inventoryContext?.isMultiLocation && sale.location
        ? inventoryContext.locations.find((l) => l.id === sale.location)?.name
        : undefined;
    // os outros artigos com o mesmo número (uma venda com vários produtos)
    const siblings = sale.guideNumber
        ? (inventoryContext?.sales || []).filter((s) => s.id !== sale.id && !s.deletedAt && s.guideNumber === sale.guideNumber && s.documentType === sale.documentType)
        : [];

    const askDelete = () => {
        closeSale();
        const msg = `Tem a certeza que deseja apagar a venda ${sale.documentType} #${sale.guideNumber}? Esta ação moverá a venda para a lixeira e reporá o stock.`;
        if (inventoryContext?.confirmAction) inventoryContext.confirmAction(async () => removeSale(sale.id), "Apagar Venda", msg);
        else if (window.confirm(msg)) removeSale(sale.id);
    };

    if (editing) {
        // ao guardar (ou cancelar) volta-se à ficha, já com os dados novos
        return <EditSaleDialog sale={sale} open onOpenChange={(o) => { if (!o) setEditing(false); }} onUpdateSale={updateSale} />;
    }

    return (
        <ResponsiveDialog
            open
            onOpenChange={(o) => { if (!o) closeSale(); }}
            title={`${sale.documentType} ${sale.guideNumber}`}
            description={formatSaleMoment(sale)}
        >
            <div data-tour="sale-sheet" className="grid gap-4 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1",
                        sale.status === "Levantado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-primary/10 text-primary")}>
                        {sale.status === "Levantado" ? <CheckCircle className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                        {sale.status === "Levantado" ? "Levantado" : sale.status === "Pendente" ? "Por pagar (proforma)" : "Pago · por levantar"}
                    </span>
                    {owed > 0.01 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Falta pagar {formatCurrency(owed)}</span>}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <Detail icon={Package} label="Produto" value={`${sale.productName} × ${sale.quantity} ${sale.unit || ""}`} />
                    <Detail icon={User} label="Cliente" value={sale.clientName || customer?.name || "Cliente balcão"} />
                    <Detail icon={Calendar} label="Data" value={formatSaleMoment(sale)} />
                    <Detail icon={UserCheck} label="Vendido por" value={sale.soldBy || "—"} />
                    {locationName && <Detail icon={MapPin} label="Local" value={locationName} />}
                    {sale.paymentMethod && <Detail icon={DollarSign} label="Pagamento" value={sale.paymentMethod} />}
                </div>

                <div className="space-y-1.5 rounded-lg bg-muted p-3 text-sm">
                    <Line label="Subtotal" value={formatCurrency(sale.subtotal)} />
                    {!!sale.discount && sale.discount > 0 && <Line label="Desconto" value={`- ${formatCurrency(sale.discount)}`} tone="text-red-500" />}
                    {!!sale.vat && sale.vat > 0 && <Line label="IVA" value={formatCurrency(sale.vat)} />}
                    <div className="flex items-center justify-between border-t pt-1.5 text-base font-bold">
                        <span>Total</span><span>{formatCurrency(sale.totalValue)}</span>
                    </div>
                    <Line label="Pago" value={formatCurrency(paid)} tone="text-green-600" />
                </div>

                {siblings.length > 0 && (
                    <div className="text-sm">
                        <p className="mb-1 font-semibold text-muted-foreground">Neste documento também</p>
                        <div className="divide-y rounded-lg border">
                            {siblings.map((s) => (
                                <button key={s.id} type="button" onClick={() => openSale(s.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50">
                                    <span className="min-w-0 truncate">{s.productName} × {s.quantity}</span>
                                    <span className="shrink-0 tabular-nums">{formatCurrency(s.totalValue)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {sale.notes && <p className="rounded-md border bg-background p-3 text-sm">{sale.notes}</p>}

                <div className="grid grid-cols-2 gap-2" data-tour="sale-sheet-actions">
                    {canEditSales && (
                        <Button className="col-span-2" onClick={() => setEditing(true)}>
                            <Edit className="mr-2 h-4 w-4" /> Corrigir venda (data, cliente, pagamento…)
                        </Button>
                    )}
                    {canEditSales && owed > 0.01 && (
                        <Button variant="outline" className="text-amber-700" onClick={() => updateSale(paidInFull(sale))}>
                            <DollarSign className="mr-2 h-4 w-4" /> Pago por inteiro
                        </Button>
                    )}
                    {canPickup && (
                        <Button variant="outline" className="text-emerald-700" onClick={() => confirmPickup(sale)}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Levantado
                        </Button>
                    )}
                    <Button variant="outline" onClick={print}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
                    <Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" /> PDF</Button>
                    {customer?.email && (
                        <Button variant="outline" onClick={sendReceipt}><Mail className="mr-2 h-4 w-4" /> Recibo por email</Button>
                    )}
                    {canEditSales && isManager && (
                        <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={askDelete}>
                            <Trash2 className="mr-2 h-4 w-4" /> Apagar
                        </Button>
                    )}
                </div>
                {!canEditSales && <p className="text-center text-xs text-muted-foreground">Para corrigir esta venda, peça a quem gere as vendas.</p>}
            </div>
        </ResponsiveDialog>
    );
}

function Detail({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    return (
        <div className="flex min-w-0 items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="break-words font-semibold">{value}</p>
            </div>
        </div>
    );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("font-semibold", tone)}>{value}</span>
        </div>
    );
}
