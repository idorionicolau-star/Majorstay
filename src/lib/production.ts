import type { Production } from "@/lib/types";

/**
 * Since 2026-02-07 20:09 (commit 459b667) every production is added to stock the moment it is registered
 * (addProduction, production logs, order completion). Only older records with status
 * 'Concluído' still need the manual "Transferir" step — showing it on newer ones
 * added the same quantity to stock a second time.
 */
export const PRODUCTION_AUTO_STOCK_SINCE = "2026-02-08";

export function isProductionInStock(p: Pick<Production, "status" | "date" | "orderId">): boolean {
    if (p.status === "Transferido") return true;
    if (p.orderId) return true;
    return (p.date || "") >= PRODUCTION_AUTO_STOCK_SINCE;
}
