// Contas do carrinho da Venda Rápida: desconto (em MT ou em %) e IVA. As mesmas contas do planBulkSale (lib/sale-plan),
// para o total que a pessoa vê ser o que fica gravado.
import { toNumber } from "@/lib/quick-stock";

export type PosTotals = {
    /** Desconto em MT. */
    discount: number;
    /** O desconto como o planBulkSale o recebe (ou nada). */
    discountInput?: { type: "fixed" | "percentage"; value: number };
    vatPercentage: number;
    vat: number;
    total: number;
};

/** "50" = 50 MT de desconto; "10%" = 10% do subtotal. IVA vazio ou 0 = sem IVA. */
export function posTotals(subtotal: number, discountText: string, vatText: string): PosTotals {
    const raw = discountText.trim();
    const isPct = raw.endsWith("%");
    const typed = Math.max(0, toNumber(isPct ? raw.slice(0, -1) : raw) || 0);
    const pct = isPct ? Math.min(100, typed) : 0;
    const discount = isPct ? subtotal * (pct / 100) : Math.min(subtotal, typed);
    const discountInput = discount > 0 ? (isPct ? { type: "percentage" as const, value: pct } : { type: "fixed" as const, value: discount }) : undefined;
    const afterDiscount = Math.max(0, subtotal - discount);
    const vatPercentage = Math.min(100, Math.max(0, toNumber(vatText.replace("%", "")) || 0));
    const vat = afterDiscount * (vatPercentage / 100);
    return { discount, discountInput, vatPercentage, vat, total: afterDiscount + vat };
}
