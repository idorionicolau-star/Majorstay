// Regras de stock das encomendas e da produção, puras (sem Firebase) para poderem ser testadas.

export type Ingredient = { quantity: number; yieldPerUnit?: number };

/**
 * Matéria-prima necessária para produzir `produced` unidades. Com rendimento (1 saco → 75 peças) arredonda
 * para cima, nunca meios sacos: 76 peças = 2 sacos. Sem rendimento, é linear.
 */
export function ingredientRequiredQty(ing: Ingredient, produced: number): number {
    const yieldPer = ing.yieldPerUnit && ing.yieldPerUnit > 0 ? ing.yieldPerUnit : null;
    return yieldPer ? Math.ceil(produced / yieldPer) * ing.quantity : ing.quantity * produced;
}

export type ReservationPlan =
    | { kind: 'reserve' }
    | { kind: 'create' }
    | { kind: 'refuse'; available: number };

/**
 * O que fazer ao stock quando se regista uma encomenda.
 * - Fabricante: a encomenda pode ser maior do que o stock (vai ser produzida) → reserva sempre; se o produto
 *   ainda não existe no inventário, cria-o com stock 0 para a reserva e a produção terem onde cair.
 * - Revendedor: só se vende o que há → recusa se o disponível (stock − reservado) não chega.
 */
export function planOrderReservation(
    found: { stock?: number; reservedStock?: number } | null,
    quantity: number,
    manufacturer: boolean,
): ReservationPlan {
    if (manufacturer) return found ? { kind: 'reserve' } : { kind: 'create' };
    const available = found ? (found.stock || 0) - (found.reservedStock || 0) : 0;
    return found && available >= quantity ? { kind: 'reserve' } : { kind: 'refuse', available: Math.max(0, available) };
}

/**
 * Quanto da reserva libertar ao entregar ou apagar uma encomenda: o que ela reservou de facto.
 * Encomendas antigas não guardam isso — mantém-se a regra antiga (a quantidade toda).
 */
export function reservedToRelease(order: { quantity: number; reservedQuantity?: number }): number {
    return order.reservedQuantity !== undefined ? order.reservedQuantity : order.quantity;
}

type OrderQty = { quantity: number; quantityProduced?: number; quantityDelivered?: number; reservedQuantity?: number };
const num = (v: unknown) => Math.max(0, Number(v) || 0);

/** Quanto o cliente já levou desta encomenda (levantamentos parciais). */
export const orderDelivered = (o: OrderQty) => Math.min(num(o.quantityDelivered), num(o.quantity));
/** Quanto ainda falta o cliente levar. */
export const orderToDeliver = (o: OrderQty) => Math.max(0, num(o.quantity) - orderDelivered(o));
/**
 * Quanto ainda falta produzir. `quantityProduced` é o que foi produzido para a encomenda e ainda está no stock;
 * o que o cliente já levou já não precisa de ser produzido.
 */
export const orderToProduce = (o: OrderQty) => Math.max(0, orderToDeliver(o) - num(o.quantityProduced));

export type PartialDelivery =
    | { ok: true; quantityDelivered: number; quantityProduced: number; reservedQuantity: number; releaseReserved: number }
    | { ok: false; error: string };

/**
 * O cliente leva já uma parte da encomenda (o que há em stock). Sai do stock e da reserva; o que foi produzido
 * para a encomenda é o primeiro a sair, por isso o que falta produzir fica certo:
 * encomenda 100, 30 já em stock, leva 30 → faltam produzir 70.
 * Para levar tudo o que falta usa-se "Entregar" (finalizeOrder), que também recebe o resto do pagamento.
 */
export function planPartialDelivery(order: OrderQty, qty: number, stockAvailable: number): PartialDelivery {
    const q = Number(qty);
    const left = orderToDeliver(order);
    if (!(q > 0)) return { ok: false, error: 'Indique quanto o cliente leva.' };
    if (q >= left) return { ok: false, error: `Para levar tudo o que falta (${left}), use "Entregar".` };
    if (q > num(stockAvailable)) return { ok: false, error: `Só há ${num(stockAvailable)} em stock.` };
    const reserved = reservedToRelease(order as { quantity: number; reservedQuantity?: number });
    const releaseReserved = Math.min(q, num(reserved));
    return {
        ok: true,
        quantityDelivered: orderDelivered(order) + q,
        quantityProduced: Math.max(0, num(order.quantityProduced) - q),
        reservedQuantity: Math.max(0, num(reserved) - releaseReserved),
        releaseReserved,
    };
}
