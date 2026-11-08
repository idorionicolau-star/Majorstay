"use client";

import { useState } from "react";
import { Loader2, PackageOpen } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInventory } from "@/context/inventory-context";
import { orderToDeliver, planPartialDelivery } from "@/lib/order-stock";
import { sameLocation } from "@/lib/product-ref";
import type { Order } from "@/lib/types";

/** O cliente leva já uma parte da encomenda, do que há em stock; o resto fica à espera de produção. */
export function PartialPickupDialog({ order }: { order: Order }) {
    const { products, deliverOrderPart } = useInventory();
    const [open, setOpen] = useState(false);
    const [qty, setQty] = useState("");
    const [busy, setBusy] = useState(false);
    const left = orderToDeliver(order);
    const stock = (products || [])
        .filter((p) => !p.deletedAt && p.name === order.productName && sameLocation(p.location, order.location))
        .reduce((t, p) => t + (Number(p.stock) || 0), 0);
    const n = Number(qty.replace(",", ".")) || 0;
    const plan = planPartialDelivery(order, n, stock);

    const save = async () => {
        if (!plan.ok || busy) return;
        setBusy(true);
        const ok = await deliverOrderPart(order.id, n);
        setBusy(false);
        if (ok) { setOpen(false); setQty(""); }
    };

    return (
        <ResponsiveDialog open={open} onOpenChange={setOpen} title="Levantar parte"
            description="O cliente leva já o que há em stock. O resto fica na encomenda à espera de produção."
            trigger={<Button variant="outline" size="sm" className="flex-1" data-tour="orders-partial"><PackageOpen className="mr-2 h-4 w-4" /> Levantar parte</Button>}>
            <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">Falta levar <b>{left} {order.unit}</b> · em stock: <b>{stock} {order.unit}</b></p>
                <div className="flex items-center gap-2">
                    <Input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantidade que o cliente leva" placeholder="Quanto leva agora" className="h-12 text-lg" />
                    {stock > 0 && left > 1 && <Button type="button" variant="ghost" onClick={() => setQty(String(Math.min(stock, left - 1)))}>Tudo o que há</Button>}
                </div>
                {qty && !plan.ok && <p className="text-sm text-red-600">{plan.error}</p>}
                {plan.ok && <p className="text-sm">Depois disto faltam levar <b>{left - n} {order.unit}</b>.</p>}
                <Button type="button" onClick={save} disabled={!plan.ok || busy} className="h-12 w-full">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registar levantamento
                </Button>
            </div>
        </ResponsiveDialog>
    );
}
