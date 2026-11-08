import { describe, it, expect } from 'vitest';
import { aliasMap, applyAliases, planMergeIntoVariant, planRename, renameClash, renamePairs } from '@/lib/rename';

const catalog = [
    { id: 'c1', name: 'Cimento' },
    { id: 'c2', name: 'Pavê - Vermelho', variantGroup: 'Pavê' },
    { id: 'c3', name: 'Pavê - Cinzento', variantGroup: 'Pavê' },
    { id: 'c4', name: 'Areia' },
];
const products = [
    { id: 'p1', name: 'Cimento' }, // armazém A
    { id: 'p2', name: 'cimento' }, // armazém B (maiúsculas diferentes)
    { id: 'p3', name: 'Pavê - Vermelho', variantGroup: 'Pavê' },
];

describe('mudar o nome de um produto', () => {
    it('produto simples: um par', () => {
        expect(renamePairs(catalog[0], '  Cimento  32,5N ', catalog)).toEqual([{ from: 'Cimento', to: 'Cimento 32,5N' }]);
        expect(renamePairs(catalog[0], 'Cimento', catalog)).toEqual([]);
        expect(renamePairs(catalog[0], '  ', catalog)).toEqual([]);
    });
    it('família de variações: muda a base de todas', () => {
        expect(renamePairs(catalog[1], 'Pavê Borbulha', catalog, true)).toEqual([
            { from: 'Pavê - Vermelho', to: 'Pavê Borbulha - Vermelho' },
            { from: 'Pavê - Cinzento', to: 'Pavê Borbulha - Cinzento' },
        ]);
    });
    it('não deixa usar o nome de outro produto', () => {
        expect(renameClash([{ from: 'Cimento', to: 'areia' }], catalog)).toBe('areia');
        expect(renameClash([{ from: 'Cimento', to: 'CIMENTO' }], catalog)).toBeNull(); // só maiúsculas
        expect(renameClash([{ from: 'Cimento', to: 'Cimento 32,5N' }], catalog)).toBeNull();
    });
    it('plano: catálogo, stock em todas as localizações, receitas e encomendas em aberto', () => {
        const plan = planRename([{ from: 'Cimento', to: 'Cimento 32,5N' }], {
            catalog, products,
            recipes: [{ id: 'r1', productName: 'Cimento' }, { id: 'r2', productName: 'Areia' }],
            orders: [
                { id: 'o1', productName: 'Cimento', status: 'Pendente' },
                { id: 'o2', productName: 'Cimento', status: 'Entregue' },
                { id: 'o3', productName: 'Cimento', status: 'Pendente', deletedAt: '2026-01-01' },
            ],
        });
        expect(plan.catalog).toEqual([{ id: 'c1', data: { name: 'Cimento 32,5N', formerNames: ['Cimento'] } }]);
        expect(plan.products.map((p) => p.id)).toEqual(['p1', 'p2']);
        expect(plan.recipes).toEqual([{ id: 'r1', productName: 'Cimento 32,5N' }]);
        expect(plan.orders).toEqual([{ id: 'o1', productName: 'Cimento 32,5N' }]);
    });
    it('plano de família: grava também a base nova', () => {
        const pairs = renamePairs(catalog[1], 'Pavê Borbulha', catalog, true);
        const plan = planRename(pairs, { catalog, products, recipes: [], orders: [] }, 'Pavê Borbulha');
        expect(plan.catalog[0].data).toEqual({ name: 'Pavê Borbulha - Vermelho', formerNames: ['Pavê - Vermelho'], variantGroup: 'Pavê Borbulha' });
        expect(plan.products[0].data.variantGroup).toBe('Pavê Borbulha');
    });
    it('nomes antigos acumulam-se e voltar ao nome antigo não o guarda como antigo', () => {
        const once = planRename([{ from: 'Cimento', to: 'Cimento B' }], { catalog: [{ id: 'c1', name: 'Cimento', formerNames: ['Cimento A'] }], products: [], recipes: [], orders: [] });
        expect(once.catalog[0].data.formerNames).toEqual(['Cimento A', 'Cimento']);
        const back = planRename([{ from: 'Cimento B', to: 'Cimento A' }], { catalog: [{ id: 'c1', name: 'Cimento B', formerNames: ['Cimento A', 'Cimento'] }], products: [], recipes: [], orders: [] });
        expect(back.catalog[0].data.formerNames).toEqual(['Cimento', 'Cimento B']);
    });
    it('histórico aparece com o nome novo', () => {
        const aliases = aliasMap([{ name: 'Cimento 32,5N', formerNames: ['Cimento'] }], [{ name: 'Cimento 32,5N', formerNames: ['Cimento'] }]);
        const sales = [{ productName: 'cimento' }, { productName: 'Areia' }];
        const out = applyAliases(sales, aliases)!;
        expect(out[0].productName).toBe('Cimento 32,5N');
        expect(out[1]).toBe(sales[1]);
        // sem nomes antigos: a mesma lista (não obriga a recalcular nada)
        expect(applyAliases(sales, new Map())).toBe(sales);
    });
    it('um nome antigo reutilizado por outro produto deixa de ser alias', () => {
        const aliases = aliasMap([{ name: 'Cimento 32,5N', formerNames: ['Cimento'] }, { name: 'Cimento' }]);
        expect(aliases.has('cimento')).toBe(false);
    });
});

describe('produto que passa a ter variações', () => {
    it('o produto actual vira a primeira variação (nome, família e valores juntos)', () => {
        const plan = planRename([{ from: 'Cimento', to: 'Cimento - Cinzento' }], { catalog, products, recipes: [], orders: [] }, undefined, { variantGroup: 'Cimento', variantValues: { Cor: 'Cinzento' } });
        expect(plan.catalog[0].data).toEqual({ name: 'Cimento - Cinzento', formerNames: ['Cimento'], variantGroup: 'Cimento', variantValues: { Cor: 'Cinzento' } });
        expect(plan.products.every((p) => p.data.variantGroup === 'Cimento')).toBe(true);
    });
});

describe('juntar um produto solto a uma variação que já existe', () => {
    const cat = [
        { id: 'k0', name: 'Pavê Borbulha' },
        { id: 'k1', name: 'Pavê Borbulha - Preto', variantGroup: 'Pavê Borbulha', variantValues: { Cor: 'Preto' } },
    ];
    it('o stock passa para a variação; a entrada solta vai para a lixeira', () => {
        const r = planMergeIntoVariant('Pavê Borbulha', cat[1], {
            catalog: cat,
            products: [{ id: 's1', name: 'Pavê Borbulha', location: 'A' }],
            recipes: [], orders: [{ id: 'o1', productName: 'Pavê Borbulha', status: 'Pendente' }],
        });
        expect(r.clash).toBeNull();
        expect(r.plan.products[0]).toEqual({ id: 's1', data: { name: 'Pavê Borbulha - Preto', formerNames: ['Pavê Borbulha'], variantGroup: 'Pavê Borbulha', variantValues: { Cor: 'Preto' } } });
        expect(r.plan.catalog).toEqual([{ id: 'k1', data: { name: 'Pavê Borbulha - Preto', formerNames: ['Pavê Borbulha'] } }]);
        expect(r.plan.orders).toEqual([{ id: 'o1', productName: 'Pavê Borbulha - Preto' }]);
        expect(r.trash).toEqual(['k0']);
    });
    it('não junta se a variação já tem stock na mesma localização', () => {
        const r = planMergeIntoVariant('Pavê Borbulha', cat[1], {
            catalog: cat,
            products: [{ id: 's1', name: 'Pavê Borbulha', location: 'A' }, { id: 's2', name: 'Pavê Borbulha - Preto', location: 'A' }],
            recipes: [], orders: [],
        });
        expect(r.clash).toBe('Pavê Borbulha - Preto');
    });
});
