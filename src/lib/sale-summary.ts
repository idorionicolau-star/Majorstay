// Resumo de uma venda com vários produtos (emails, notificações): antes ia só o primeiro. Puro, para ser testado.

export type SaleLine = { productName: string; quantity: number; unit?: string; subtotal: number };

/** "Cimento" · "Cimento e mais 1 produto" · "Cimento e mais 3 produtos". */
export function itemsSummary(names: string[]): string {
    const list = names.filter(Boolean);
    if (list.length <= 1) return list[0] || 'Venda';
    const more = list.length - 1;
    return `${list[0]} e mais ${more} ${more === 1 ? 'produto' : 'produtos'}`;
}

/** Linhas para o email a partir das vendas com o mesmo número. */
export const saleLines = (sales: { productName: string; quantity: number; unit?: string; totalValue: number }[]): SaleLine[] =>
    sales.map((s) => ({ productName: s.productName, quantity: s.quantity, unit: s.unit, subtotal: Number(s.totalValue) || 0 }));
