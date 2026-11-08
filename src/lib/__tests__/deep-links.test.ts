import { describe, it, expect } from 'vitest';
import { links, parseInventoryFocus, applyInventoryFocus, hasInventoryFocus, inventoryFocusTitle, safeReturn } from '../deep-links';
import { suggestedQuantity } from '../business-analysis';
import type { Product } from '../types';

const p = (o: Partial<Product>): Product => ({ id: o.name || 'x', name: 'X', stock: 10, reservedStock: 0, price: 100, cost: 50, category: 'Geral', unit: 'un', location: 'l1', ...o } as Product);
const params = (url: string) => new URL(url, 'http://x').searchParams;

describe('deep-links', () => {
  const products = [
    p({ name: 'Cimento', price: 0 }),
    p({ name: 'Areia', cost: 0, stock: 0 }),
    p({ name: 'Tinta', criticalStockThreshold: 5, lowStockThreshold: 10, stock: 3, category: 'Tintas' }),
    p({ name: 'Cimento', location: 'l2', price: 300 }),
  ];

  it('os links levam ao caso e fazem round-trip', () => {
    const f = parseInventoryFocus(params(links.inventoryProblem('sem-preco')));
    expect(f.problem).toBe('sem-preco');
    expect(applyInventoryFocus(products, f).map((x) => x.name)).toEqual(['Cimento']);
  });

  it('produto concreto: respeita o local e ignora acentos/maiúsculas', () => {
    const f = parseInventoryFocus(params(links.product('cimento', 'l2')));
    const r = applyInventoryFocus(products, f);
    expect(r).toHaveLength(1);
    expect(r[0].location).toBe('l2');
  });

  it('produto sem o local certo cai para o mesmo nome noutro local', () => {
    const f = parseInventoryFocus(params(links.product('Cimento', 'l9')));
    expect(applyInventoryFocus(products, f)).toHaveLength(2);
  });

  it('lista de nomes (alerta com vários produtos)', () => {
    const f = parseInventoryFocus(params(links.products(['Areia', 'Tinta'], 'Teste')));
    expect(applyInventoryFocus(products, f).map((x) => x.name).sort()).toEqual(['Areia', 'Tinta']);
    expect(inventoryFocusTitle(f, 2).title).toBe('Teste (2)');
  });

  it('esgotado e crítico', () => {
    expect(applyInventoryFocus(products, parseInventoryFocus(params(links.inventoryProblem('esgotado')))).map((x) => x.name)).toEqual(['Areia']);
    expect(applyInventoryFocus(products, parseInventoryFocus(params(links.inventoryProblem('critico')))).map((x) => x.name)).toEqual(['Tinta']);
  });

  it('sem parâmetros = lista normal; problema inválido é ignorado', () => {
    expect(hasInventoryFocus(parseInventoryFocus(params('/inventory')))).toBe(false);
    expect(parseInventoryFocus(params('/inventory?problema=hack')).problem).toBeNull();
  });

  it('nomes com caracteres especiais sobrevivem ao URL', () => {
    const name = 'Bloco 15x40 & "especial" | teste';
    expect(parseInventoryFocus(params(links.product(name))).product).toBe(name);
  });

  it('links das vendas e funcionários', () => {
    expect(links.sale('GT-0012')).toBe('/sales?venda=GT-0012');
    expect(links.employee('u1')).toBe('/users?funcionario=u1');
    expect(links.order('o1')).toBe('/orders?encomenda=o1');
  });
});

describe('regressar sem perder o filtro', () => {
    it('só aceita endereços da app e da secção certa', () => {
        expect(safeReturn('/inventory?problema=sem-preco', '/inventory', '/inventory')).toBe('/inventory?problema=sem-preco');
        expect(safeReturn('/production?planear=1', '/production', '/production')).toBe('/production?planear=1');
        expect(safeReturn('https://mal.com', '/inventory', '/inventory')).toBe('/inventory');
        expect(safeReturn('//mal.com/inventory', '/inventory', '/inventory')).toBe('/inventory');
        expect(safeReturn('/sales', '/inventory', '/inventory')).toBe('/inventory');
        expect(safeReturn('/inventoryx', '/inventory', '/inventory')).toBe('/inventory');
        expect(safeReturn(null, '/production', '/production')).toBe('/production');
    });
    it('registar produção já preenchida', () => {
        expect(links.newProduction('Pavê 6cm', 120, 'loc1', links.productionPlan()))
            .toBe('/production/new?produto=Pav%C3%AA+6cm&quantidade=120&local=loc1&voltar=%2Fproduction%3Fplanear%3D1');
        expect(links.newProduction('Bloco')).toBe('/production/new?produto=Bloco');
    });
});

describe('quanto produzir', () => {
    it('cobre 30 dias de vendas, descontando o que há', () => {
        expect(suggestedQuantity({ available: 20, soldPerDay: 5 })).toBe(130);
        expect(suggestedQuantity({ available: -10, soldPerDay: 1.1 })).toBe(33);
        expect(suggestedQuantity({ available: 500, soldPerDay: 5 })).toBe(0);
    });
});
