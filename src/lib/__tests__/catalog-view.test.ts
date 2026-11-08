import { describe, expect, it } from 'vitest';
import { activeCatalog, adjustPrice, categoryCounts, filterCatalog, findDuplicate, nameKey, parsePct, searchCatalog } from '../catalog-view';

const item = (id: string, name: string, category = 'Geral', price = 10, extra: object = {}) => ({ id, name, category, price, unit: 'un', ...extra });
const cat = [
    item('1', 'Tábua de Pinho', 'Madeiras', 120),
    item('2', 'Cimento Cola', 'Cimentos', 450),
    item('3', 'Cimento 32.5N', 'Cimentos', 600),
    item('4', 'Tinta Branca 20L', 'Tintas', 2300),
    item('5', 'Bloco 15', 'Blocos', 45),
    item('6', 'Bloco 20', 'Blocos', 55),
    item('7', 'Pavê Borbulha', 'Pavimentos', 380),
    item('8', 'Apagado', 'Geral', 1, { deletedAt: '2026-01-01' }),
];
const names = (l: { name: string }[]) => l.map((x) => x.name);

describe('pesquisa no catálogo', () => {
    it('ignora acentos e maiúsculas', () => {
        expect(names(searchCatalog(cat, 'tabua'))).toEqual(['Tábua de Pinho']);
        expect(names(searchCatalog(cat, 'PAVE borbulha'))).toEqual(['Pavê Borbulha']);
    });
    it('tolera gralhas', () => {
        expect(names(searchCatalog(cat, 'cimeto cola'))[0]).toBe('Cimento Cola');
    });
    it('aceita o plural', () => {
        expect(names(searchCatalog(cat, 'blocos')).sort()).toEqual(['Bloco 15', 'Bloco 20']);
    });
    it('procura também na categoria', () => {
        expect(names(searchCatalog(cat, 'tintas'))).toEqual(['Tinta Branca 20L']);
        expect(names(searchCatalog(cat, 'madeiras'))).toEqual(['Tábua de Pinho']);
    });
    it('números não se confundem', () => {
        expect(names(searchCatalog(cat, 'bloco 15'))).toEqual(['Bloco 15']);
    });
    it('sem texto devolve tudo; nada parecido devolve vazio', () => {
        expect(searchCatalog(cat, '  ')).toBe(cat);
        expect(searchCatalog(cat, 'martelo de borracha')).toEqual([]);
    });
});

describe('filtros e ordenação', () => {
    it('por categoria', () => {
        expect(names(filterCatalog(cat, { category: 'Cimentos' })).sort()).toEqual(['Cimento 32.5N', 'Cimento Cola']);
        expect(filterCatalog(cat, { category: 'all' }).length).toBe(cat.length);
    });
    it('por nome e por preço, sem alterar a lista original', () => {
        const copy = [...cat];
        expect(names(filterCatalog(cat, { sort: 'price-desc' }))[0]).toBe('Tinta Branca 20L');
        expect(names(filterCatalog(cat, { sort: 'price-asc' }))[0]).toBe('Apagado');
        expect(names(filterCatalog(cat, { sort: 'name' }))[0]).toBe('Apagado');
        expect(cat).toEqual(copy);
    });
    it('ordem natural dos números: Bloco 15 antes de Bloco 100', () => {
        const l = [item('a', 'Bloco 100'), item('b', 'Bloco 15'), item('c', 'Bloco 20')];
        expect(names(filterCatalog(l, { sort: 'name' }))).toEqual(['Bloco 15', 'Bloco 20', 'Bloco 100']);
    });
    it('com texto mantém a ordem de relevância', () => {
        expect(names(filterCatalog(cat, { term: 'cimento', sort: 'relevance' })).length).toBe(2);
    });
});

describe('lixeira, duplicados e preços', () => {
    it('só os activos', () => {
        expect(activeCatalog(cat).length).toBe(7);
        expect(activeCatalog(null)).toEqual([]);
    });
    it('duplicados ignoram acentos, maiúsculas e espaços', () => {
        expect(findDuplicate(cat, '  pave   BORBULHA ')?.id).toBe('7');
        expect(findDuplicate(cat, 'Pavê Borbulha', '7')).toBeUndefined();
        expect(findDuplicate(cat, 'Pavê Liso')).toBeUndefined();
        expect(findDuplicate(cat, '   ')).toBeUndefined();
    });
    it('ajuste de preço em %', () => {
        expect(adjustPrice(100, 10)).toBe(110);
        expect(adjustPrice(100, -25)).toBe(75);
        expect(adjustPrice(33.33, 7.5)).toBe(35.83);
        expect(adjustPrice(10, -100)).toBe(0);
        expect(adjustPrice(NaN as unknown as number, 10)).toBe(0);
    });
    it('percentagem escrita pela pessoa', () => {
        expect(parsePct('10')).toBe(10);
        expect(parsePct('-5')).toBe(-5);
        expect(parsePct('7,5')).toBe(7.5);
        expect(parsePct('abc')).toBeNull();
        expect(parsePct('-100')).toBeNull();
    });
    it('contagem por categoria e chave de nome', () => {
        expect(categoryCounts(cat).get('Blocos')).toBe(2);
        expect(nameKey(' Pavê  X ')).toBe('pave x');
    });
});

import { buildSyncPlan } from '../catalog-view';
describe('sincronizar inventário', () => {
    it('só o que falta, um por nome, sem a lixeira', () => {
        const inv = [
            { name: 'Cimento Cola', category: 'Cimentos', price: 450 },       // já existe
            { name: 'Parafuso M8', category: 'Ferragens', price: 5 },
            { name: 'parafuso  m8', category: 'Ferragens', price: 5 },        // mesmo nome noutro local
            { name: 'Serra', price: 90, deletedAt: '2026-01-01' },            // lixeira
            { name: 'Lixa', price: 0 },                                       // sem categoria
        ];
        const plan = buildSyncPlan(inv, cat, ['Cimentos', 'Tintas']);
        expect(plan.products.map((p) => p.name)).toEqual(['Parafuso M8', 'Lixa']);
        expect(plan.products[1].category).toBe('Geral');
        expect(plan.newCategories.sort()).toEqual(['Ferragens', 'Geral']);
    });
    it('nada em falta', () => {
        expect(buildSyncPlan([{ name: 'bloco 15' }], cat, []).products).toEqual([]);
    });
});

import { copyName, findBarcodeClash, marginPct, MAX_PRICE_HISTORY, pushPriceHistory, sameCodeKey } from '../catalog-view';
describe('código de barras, margem, histórico e cópias', () => {
    const withCode = [
        { id: 'a', name: 'Cola', barcode: '5601234567890', price: 100, cost: 70 },
        { id: 'b', name: 'Prego', barcode: '012345678905', price: 5 },
        { id: 'c', name: 'Sem código', price: 5 },
    ];
    it('procura por código lido, mesmo com espaços ou zero à esquerda', () => {
        expect(searchCatalog(withCode, '5601234567890').map((i) => i.id)).toEqual(['a']);
        expect(searchCatalog(withCode, '5601234567890 '.trim()).length).toBe(1);
        expect(searchCatalog(withCode, '0012345678905').map((i) => i.id)).toEqual(['b']); // UPC-A / EAN-13
    });
    it('código repetido entre produtos', () => {
        expect(findBarcodeClash(withCode, '5601 234 567 890')?.id).toBe('a');
        expect(findBarcodeClash(withCode, '5601234567890', 'a')).toBeUndefined();
        expect(findBarcodeClash(withCode, '')).toBeUndefined();
        expect(sameCodeKey('0012-345')).toBe('12345');
        expect(sameCodeKey('ab-12')).toBe('AB12');
    });
    it('margem sobre o preço de venda', () => {
        expect(marginPct(100, 70)).toBe(30);
        expect(marginPct(250, 100)).toBe(60);
        expect(marginPct(100, 120)).toBe(-20); // a vender com prejuízo
        expect(marginPct(100, 0)).toBeNull();
        expect(marginPct(0, 50)).toBeNull();
        expect(marginPct(undefined, undefined)).toBeNull();
    });
    it('histórico de preços: só quando muda, e no máximo 20', () => {
        const at = '2026-01-01';
        expect(pushPriceHistory(undefined, { at, from: 10, to: 10 })).toEqual([]);
        const one = pushPriceHistory(undefined, { at, from: 10, to: 12, by: 'ana' });
        expect(one).toEqual([{ at, from: 10, to: 12, by: 'ana' }]);
        let h = one;
        for (let i = 0; i < 30; i++) h = pushPriceHistory(h, { at, from: i, to: i + 1 });
        expect(h.length).toBe(MAX_PRICE_HISTORY);
        expect(h[h.length - 1].to).toBe(30);
    });
    it('nome da cópia nunca repete', () => {
        const l = [{ name: 'Bloco 15' }];
        expect(copyName(l, 'Bloco 15')).toBe('Bloco 15 (cópia)');
        const l2 = [...l, { name: 'Bloco 15 (cópia)' }];
        expect(copyName(l2, 'Bloco 15')).toBe('Bloco 15 (cópia 2)');
        expect(copyName(l2, 'Bloco 15 (cópia)')).toBe('Bloco 15 (cópia 2)'); // copiar uma cópia
        expect(copyName([{ name: 'Pavê X' }, { name: 'pave x (copia)' }], 'Pavê X')).toBe('Pavê X (cópia 2)');
    });
});
