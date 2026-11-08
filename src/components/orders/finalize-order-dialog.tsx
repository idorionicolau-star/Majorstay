"use client";

import { useState, useContext } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InventoryContext } from "@/context/inventory-context";
import { Order } from "@/lib/types";
import { CheckCircle2, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface FinalizeOrderDialogProps {
    order: Order;
    saleAmountPaid: number;
    saleTotal: number;
}

export function FinalizeOrderDialog({ order, saleAmountPaid, saleTotal }: FinalizeOrderDialogProps) {
    const [open, setOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<string>("");
    const inventoryContext = useContext(InventoryContext);

    const remainingBalance = saleTotal - saleAmountPaid;

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            setPaymentAmount(remainingBalance.toString());
        }
    };

    const handleFinalize = async () => {
        if (!inventoryContext) return;

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount < 0) {
            return; // Add validations
        }

        await inventoryContext.finalizeOrder(order.id, amount);
        setOpen(false);
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={handleOpenChange}
            title="Finalizar e Levantar Encomenda"
            description="Confirme o pagamento final e a entrega da encomenda ao cliente."
            trigger={
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Finalizar / Levantar
                </Button>
            }
        >

            <div className="grid gap-4 py-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor Total:</span>
                        <span className="font-semibold">{formatCurrency(saleTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Já Pago:</span>
                        <span className="font-semibold text-emerald-600">{formatCurrency(saleAmountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-base border-t pt-2">
                        <span className="font-bold">Em Falta:</span>
                        <span className="font-bold text-destructive">{formatCurrency(remainingBalance)}</span>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="payment">Pagamento Final</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="payment"
                            type="number"
                            placeholder="0.00"
                            className="pl-8"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleFinalize} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Confirmar Pagamento e Entrega
                </Button>
            </div>
        </ResponsiveDialog>
    );
}
