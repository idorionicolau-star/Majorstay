"use client";

import Link from "next/link";
import { PackageCheck, ChevronRight } from "lucide-react";
import { useShipments } from "@/hooks/use-shipments";
import { pendingFor } from "@/lib/shipments";

/** Aviso no Painel: envios que chegaram aos meus locais e ainda não foram confirmados. */
export function PendingShipmentsBanner() {
    const sh = useShipments();
    const n = sh.enabled ? pendingFor(sh.shipments, sh.mine).length : 0;
    if (!n) return null;
    return (
        <Link href="/inventory/transfer?tab=receber" data-testid="pending-shipments"
            className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/15">
            <PackageCheck className="h-5 w-5 shrink-0 text-amber-600" />
            <span className="flex-1"><b>{n} {n === 1 ? "envio" : "envios"} por receber</b><span className="block text-xs text-muted-foreground">Confira o que chegou e confirme a receção.</span></span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
    );
}
