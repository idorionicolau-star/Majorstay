// Carrinhos retidos ("Reter carrinho"): o cliente foi buscar dinheiro, o balcão continua a vender. Puro, para testes.
import type { CartItem } from '@/lib/types';

export type HeldCart = { id: string; at: string; items: CartItem[]; total: number };

/** No máximo tantos retidos: os mais antigos saem (um carrinho esquecido não fica para sempre). */
export const MAX_HELD = 10;

const totalOf = (items: CartItem[]) => items.reduce((s, i) => s + i.subtotal, 0);

/** Guarda o carrinho atual (vazio não conta) à frente da lista. */
export function holdCart(list: HeldCart[], items: CartItem[], now: Date): HeldCart[] {
    if (!items.length) return list;
    const held: HeldCart = { id: `${now.getTime()}-${list.length}`, at: now.toISOString(), items, total: totalOf(items) };
    return [held, ...list].slice(0, MAX_HELD);
}

/** Retoma um retido; se havia um carrinho a meio, esse fica retido no lugar dele. */
export function resumeCart(list: HeldCart[], id: string, current: CartItem[], now: Date): { list: HeldCart[]; cart: CartItem[] } | null {
    const held = list.find((h) => h.id === id);
    if (!held) return null;
    return { list: holdCart(list.filter((h) => h.id !== id), current, now), cart: held.items };
}

/** Lê a lista guardada, ignorando lixo. */
export function parseHeld(raw: string | null): HeldCart[] {
    try {
        const v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v.filter((h) => h && typeof h.id === 'string' && Array.isArray(h.items)) : [];
    } catch {
        return [];
    }
}
