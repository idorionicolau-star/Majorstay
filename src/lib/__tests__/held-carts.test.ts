import { describe, expect, it } from 'vitest';
import { holdCart, resumeCart, parseHeld, MAX_HELD } from '../held-carts';
import { receiptText, waPhone, waShareLink } from '../sale-share';

const item = (name: string, q = 1, p = 100) => ({ productId: name, productName: name, quantity: q, unitPrice: p, subtotal: q * p, unit: 'un' });
const t = new Date('2026-10-20T10:00:00Z');

describe('reter carrinho', () => {
    it('retém o carrinho com o total; vazio não conta', () => {
        const l = holdCart([], [item('Arroz', 2, 50)], t);
        expect(l).toHaveLength(1);
        expect(l[0].total).toBe(100);
        expect(holdCart(l, [], t)).toBe(l);
    });
    it('retomar troca: o carrinho a meio fica retido', () => {
        const l = holdCart([], [item('Arroz')], t);
        const r = resumeCart(l, l[0].id, [item('Óleo')], new Date(t.getTime() + 1000))!;
        expect(r.cart[0].productName).toBe('Arroz');
        expect(r.list).toHaveLength(1);
        expect(r.list[0].items[0].productName).toBe('Óleo');
        expect(resumeCart(l, 'nao-existe', [], t)).toBeNull();
    });
    it('no máximo MAX_HELD, e lista estragada não parte nada', () => {
        let l: ReturnType<typeof holdCart> = [];
        for (let k = 0; k < MAX_HELD + 3; k++) l = holdCart(l, [item(`P${k}`)], new Date(t.getTime() + k));
        expect(l).toHaveLength(MAX_HELD);
        expect(l[0].items[0].productName).toBe(`P${MAX_HELD + 2}`);
        expect(parseHeld('{x')).toEqual([]);
        expect(parseHeld('[{"id":"a","items":[]},5,null]')).toHaveLength(1);
    });
});

describe('recibo por WhatsApp', () => {
    it('números moçambicanos ganham o 258', () => {
        expect(waPhone('84 123 4567')).toBe('258841234567');
        expect(waPhone('+258 84 123 4567')).toBe('258841234567');
        expect(waPhone('')).toBeNull();
        expect(waShareLink('olá')).toBe('https://wa.me/?text=ol%C3%A1');
    });
    it('lista os produtos e o total', () => {
        const txt = receiptText({ company: 'Loja', client: 'Ana', items: [item('Arroz', 2, 50), item('Óleo', 1, 120)], total: 220, date: t, money: (n) => `${n} MT` });
        expect(txt).toContain('2 un × Arroz = 100 MT');
        expect(txt).toContain('1 un × Óleo = 120 MT');
        expect(txt).toContain('*Total: 220 MT*');
        expect(txt).toContain('Ana');
    });
});
