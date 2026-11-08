// "De onde vem o stock reservado?" — lógica pura (sem Firebase nem React), para ser testada.
//
// Um produto fica com stock reservado por duas razões legítimas:
//   1. uma venda PAGA que ainda não foi levantada (não é proforma, não está na lixeira);
//   2. uma ENCOMENDA activa (Pendente / Em produção / Concluída) — reserva a quantidade que registou.
// A venda ligada a uma encomenda (orderId) NÃO conta à parte: é a encomenda que reserva (senão contava a dobrar).
// Qualquer reserva além disto é "sem origem" (uma reserva presa) e pode ser libertada.
import type { Order, Product, Sale } from '@/lib/types';
import { reservedToRelease } from '@/lib/order-stock';
import { nameKey } from '@/lib/catalog-view';
import { sameLocation } from '@/lib/product-ref';

const RESERVING_ORDER = new Set(['Pendente', 'Em produção', 'Concluída']);

type Target = { name: string; location?: string | null };

/** Esta venda/encomenda é deste produto? Num só local basta o nome; com vários locais também conta o local. */
const matches = (x: { productName?: string; location?: string }, p: Target, multi: boolean) =>
    nameKey(x.productName || '') === nameKey(p.name) && (!multi || sameLocation(x.location, p.location));

export const reservingSales = (sales: Sale[], p: Target, multi: boolean): Sale[] =>
    sales.filter((s) => !s.deletedAt && s.status === 'Pago' && s.documentType !== 'Factura Proforma' && !s.orderId && matches(s, p, multi));

export const reservingOrders = (orders: Order[], p: Target, multi: boolean): Order[] =>
    orders.filter((o) => !o.deletedAt && RESERVING_ORDER.has(o.status) && reservedToRelease(o) > 0 && matches(o, p, multi));

export type ReservedExplanation = {
    sales: Sale[];
    orders: Order[];
    /** quanto as vendas e encomendas justificam */
    explained: number;
    /** quanto o produto tem reservado */
    recorded: number;
    /** recorded − explained: >0 = reserva sem origem; <0 = falta reservar */
    drift: number;
};

export function explainReserved(product: Target & { reservedStock?: number }, sales: Sale[], orders: Order[], multi: boolean): ReservedExplanation {
    const s = reservingSales(sales, product, multi);
    const o = reservingOrders(orders, product, multi);
    const explained = s.reduce((t, x) => t + (Number(x.quantity) || 0), 0) + o.reduce((t, x) => t + reservedToRelease(x), 0);
    const recorded = Number(product.reservedStock) || 0;
    return { sales: s, orders: o, explained, recorded, drift: recorded - explained };
}

type Doc = Pick<Product, 'name' | 'location' | 'reservedStock' | 'deletedAt'> & { id?: string };

/**
 * O que cada documento de produto devia ter reservado. Documentos repetidos (mesmo nome e local) são somados na app:
 * a reserva toda fica no primeiro e os outros ficam a zero (a mesma regra de sempre).
 */
export function expectedReserved(docs: Doc[], sales: Sale[], orders: Order[], multi: boolean): { id: string; current: number; expected: number }[] {
    const seen = new Set<string>();
    const out: { id: string; current: number; expected: number }[] = [];
    for (const d of docs) {
        if (d.deletedAt || !d.id) continue;
        const key = `${nameKey(d.name)}|${multi ? (!d.location || d.location === 'Principal' ? '' : d.location) : ''}`;
        const expected = seen.has(key) ? 0 : explainReserved(d, sales, orders, multi).explained;
        seen.add(key);
        out.push({ id: d.id, current: Number(d.reservedStock) || 0, expected });
    }
    return out;
}

/** Produtos (já somados, como o cartão) com reserva diferente da que as vendas/encomendas justificam. */
export function reservedDrifts<T extends Target & { reservedStock?: number; id?: string; sourceIds?: string[] }>(products: T[], sales: Sale[], orders: Order[], multi: boolean) {
    return products
        .map((p) => ({ product: p, ...explainReserved(p, sales, orders, multi) }))
        .filter((e) => e.drift !== 0);
}
