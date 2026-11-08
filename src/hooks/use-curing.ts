"use client";

import { useMemo } from "react";
import { useInventory } from "@/context/inventory-context";
import { curingBatches, curingQty, nextReady, readyQty } from "@/lib/curing";

/**
 * Secagem da empresa: só existe se a empresa fabrica e definiu os dias de secagem (Definições).
 * Sem isso tudo é "pronto" e nada muda no comportamento.
 */
export function useCuring() {
    const { productions, companyData } = useInventory();
    const days = companyData?.businessType === "reseller" ? 0 : Math.max(0, companyData?.curingDays ?? 0);
    const batches = useMemo(() => curingBatches(productions || [], new Date(), days), [productions, days]);
    return {
        enabled: days > 0,
        days,
        batches,
        curing: (name: string, location?: string) => curingQty(batches, name, location),
        nextReady: (name: string, location?: string) => nextReady(batches, name, location),
        ready: (stock: number, name: string, location?: string) => readyQty(stock, batches, name, location),
    };
}
