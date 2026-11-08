import { describe, it, expect } from 'vitest';
import { checkFirstProduct, deriveUsername, gettingStarted, menuMode } from '@/lib/onboarding';

describe('onboarding', () => {
    it('nome de utilizador a partir do email', () => {
        expect(deriveUsername('joao.silva@empresa.co.mz')).toBe('Joao Silva');
        expect(deriveUsername('maria_99@x.com')).toBe('Maria');
        expect(deriveUsername('', 'Admin')).toBe('Admin');
    });
    it('valida a primeira venda', () => {
        expect(checkFirstProduct({ name: ' ', price: '600', qty: '10' })).toMatchObject({ ok: false, field: 'name' });
        expect(checkFirstProduct({ name: 'cimento', price: '0', qty: '10' })).toMatchObject({ ok: false, field: 'price' });
        expect(checkFirstProduct({ name: 'cimento', price: '600', qty: '' })).toMatchObject({ ok: false, field: 'qty' });
        expect(checkFirstProduct({ name: 'cimento  32,5', price: '1 200,50', qty: '10' })).toEqual({ ok: true, value: { name: 'Cimento 32,5', price: 1200.5, qty: 10 } });
    });
    it('lista de primeiros passos', () => {
        const a = gettingStarted({ demoDone: false, catalog: 0, stock: 0, sales: 0, companyDone: false });
        expect(a.done).toBe(0); expect(a.next).toBe('catalog'); expect(a.steps.map((x) => x.id)).toEqual(['catalog', 'demo', 'stock', 'sale', 'company']); expect(a.finished).toBe(false); expect(a.total).toBe(5);
        const b = gettingStarted({ demoDone: true, catalog: 3, stock: 0, sales: 0, companyDone: true });
        expect(b.next).toBe('stock');
        // quem já vende não precisa da demonstração, e ter stock conta como ter produtos
        const c = gettingStarted({ demoDone: false, catalog: 0, stock: 2, sales: 1, companyDone: true });
        expect(c.finished).toBe(true);
    });
    it('menu simples só para empresas sem vendas, a não ser que tenham escolhido', () => {
        expect(menuMode(null, 0)).toBe('simple');
        expect(menuMode(null, 5)).toBe('full');
        expect(menuMode('full', 0)).toBe('full');
        expect(menuMode('simple', 9)).toBe('simple');
    });
});
