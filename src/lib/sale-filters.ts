import type { Sale } from '@/lib/types';

/** Documentos que não são vendas: não movem dinheiro nem stock (propostas e pró-formas). */
const NON_SALE_TYPES = ['Factura Proforma', 'Cotação'];

/**
 * Uma venda "a sério" para totais, gráficos e análises: não está na lixeira e não é uma Cotação nem uma
 * Factura Proforma. Antes cada ecrã decidia por si — uns contavam cotações, o painel contava as apagadas.
 */
export const isCountableSale = (s: Pick<Sale, 'documentType'> & { deletedAt?: string }) =>
    !s.deletedAt && !NON_SALE_TYPES.includes(s.documentType);

/**
 * Dinheiro que a venda já trouxe: o que foi pago. Venda sem `amountPaid` (antiga) conta como paga por inteiro.
 * Atenção: `amountPaid || totalValue` estava errado — um 0 (venda a crédito por pagar) virava o valor total.
 */
export const saleIncome = (s: Pick<Sale, 'amountPaid' | 'totalValue'>): number => Number(s.amountPaid ?? s.totalValue) || 0;

/**
 * Ao editar o preço/quantidade de uma venda: quanto fica pago. Uma venda que estava paga por inteiro continua paga
 * por inteiro (o pago acompanha o novo total — senão o Financeiro e o relatório do dia ficavam com o preço antigo).
 * A crédito (parcial), o pago não muda, mas nunca passa do novo total. Encomendas: o que se escreveu.
 */
export function paidAfterEdit(
    before: Pick<Sale, 'amountPaid' | 'totalValue'>,
    newTotal: number,
    typedPaid?: number | null,
    isOrder = false,
): number {
    const total = Math.max(0, Number(newTotal) || 0);
    if (isOrder) return Math.max(0, Number(typedPaid) || 0);
    const oldTotal = Number(before.totalValue) || 0;
    const oldPaid = before.amountPaid == null ? oldTotal : Number(before.amountPaid) || 0;
    if (oldPaid >= oldTotal - 0.005) return total;
    return Math.min(oldPaid, total);
}

const normName = (s?: string | null) => String(s || '').trim().toLowerCase();

/**
 * A que cliente pertence a venda: pelo customerId, ou — nas que só guardaram o nome (encomendas antigas, vendas
 * escritas à mão) — pelo nome do cliente, sem distinguir maiúsculas.
 */
export function saleCustomerId(
    sale: { customerId?: string | null; clientName?: string | null },
    customers: { id: string; name: string }[],
): string | null {
    if (sale.customerId) return sale.customerId;
    const n = normName(sale.clientName);
    if (!n) return null;
    return customers.find((c) => normName(c.name) === n)?.id ?? null;
}
