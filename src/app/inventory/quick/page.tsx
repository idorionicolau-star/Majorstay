"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventory } from "@/context/inventory-context";
import { QuickStock } from "@/components/inventory/quick-stock";
import { FastEntryGrid } from "@/components/inventory/fast-entry-grid";
import type { QuickMode } from "@/lib/quick-stock";

// Toda a entrada de stock passa por aqui: entrada, saída e contagem — e, para quem prefere, a mesma entrada
// em modo folha de cálculo (`?vista=folha`), sem sair desta página.
function QuickStockPageInner() {
    const { canEdit } = useInventory();
    const params = useSearchParams();
    const router = useRouter();
    const m = params.get("modo");
    const initialMode: QuickMode = m === "saida" ? "out" : m === "contagem" ? "count" : "in";
    const sheet = params.get("vista") === "folha";

    if (!canEdit("inventory")) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <p className="text-muted-foreground">Não tem permissão para aceder a esta página.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Rápido</h1>
                    <p className="text-xs text-muted-foreground">{sheet ? "Entrada de vários produtos, em folha de cálculo." : "Entradas, saídas e contagem em segundos."}</p>
                </div>
                {sheet && (
                    <Button asChild variant="outline" size="sm" data-tour="qs-normal-view">
                        <Link href="/inventory/quick"><List className="mr-1.5 h-4 w-4" /> Modo normal</Link>
                    </Button>
                )}
            </div>
            {sheet ? (
                <div className="rounded-xl border bg-card p-2 shadow-sm sm:p-6" data-tour="qs-sheet">
                    <FastEntryGrid onSuccess={() => router.push("/inventory")} />
                </div>
            ) : (
                <QuickStock initialMode={initialMode} />
            )}
        </div>
    );
}

export default function QuickStockPage() {
    return (
        <Suspense fallback={null}>
            <QuickStockPageInner />
        </Suspense>
    );
}
