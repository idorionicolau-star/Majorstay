import { describe, it, expect } from 'vitest';
import { cleanProductName, nameKey, nameSimilarity, findNameMatches, suggestCategory, guessUnit, planCatalogWrites } from '../new-product';

describe('nomes', () => {
    it('limpa e põe a primeira letra grande', () => {
        expect(cleanProductName('  cimento   32.5n ')).toBe('Cimento 32.5n');
        expect(cleanProductName('   ')).toBe('');
    });
    it('chave ignora acentos, plural e maiúsculas', () => {
        expect(nameKey('Pavê Retangulares')).toBe(nameKey('pave retangular'));
        expect(nameKey('Bloco 15x40')).toBe(nameKey('bloco 15X40'));
    });
});

describe('semelhança', () => {
    it('igual, plural e erro de escrita contam como o mesmo/parecido', () => {
        expect(nameSimilarity('Cimento', 'cimento')).toBe(1);
        expect(nameSimilarity('Tijolos', 'Tijolo')).toBe(1);
        expect(nameSimilarity('Cimeto', 'Cimento')).toBeGreaterThanOrEqual(0.6);
    });
    it('medidas diferentes são produtos diferentes', () => {
        expect(nameSimilarity('Bloco 15', 'Bloco 20')).toBe(0);
        expect(nameSimilarity('Varão 12', 'Varão 10')).toBe(0);
    });
    it('uma medida a mais ou a menos é "parecido", não igual', () => {
        const s = nameSimilarity('Cimento', 'Cimento 32.5N');
        expect(s).toBeGreaterThanOrEqual(0.6);
        expect(s).toBeLessThan(1);
    });
    it('coisas sem relação não aparecem', () => {
        expect(nameSimilarity('Cimento', 'Tinta branca')).toBe(0);
        expect(nameSimilarity('Areia fina', 'Areia grossa')).toBe(0);
    });
});

describe('findNameMatches', () => {
    const inventory = [{ name: 'Cimento 32.5N', category: 'Cimento', location: 'A' }, { name: 'Bloco 15', category: 'Blocos', location: 'A' }];
    const catalog = [{ name: 'Cimento 42.5R', category: 'Cimento' }, { name: 'Cimento', category: 'Cimento' }];

    it('encontra o exacto no catálogo e os parecidos do inventário', () => {
        const m = findNameMatches('Cimento', { inventory, catalog });
        expect(m[0]).toMatchObject({ name: 'Cimento', kind: 'exact', source: 'catalog' });
        expect(m.some((x) => x.name === 'Cimento 32.5N' && x.source === 'inventory')).toBe(true);
    });
    it('não mistura medidas diferentes', () => {
        expect(findNameMatches('Bloco 20', { inventory, catalog })).toEqual([]);
    });
    it('não repete o mesmo produto', () => {
        const m = findNameMatches('Bloco 15', { inventory: [inventory[1], { ...inventory[1] }], catalog: [] });
        expect(m).toHaveLength(1);
    });
});

describe('categoria e unidade', () => {
    it('sugere pelo nome e reaproveita categoria existente', () => {
        expect(suggestCategory('Cimento', ['Cimento', 'Blocos'], [])).toEqual({ category: 'Cimento', source: 'keyword', isNew: false });
        expect(suggestCategory('Tinta branca 20L', ['Cimento'], [])).toEqual({ category: 'Tintas', source: 'keyword', isNew: true });
    });
    it('sem pista fica Geral', () => {
        expect(suggestCategory('Xyzzy', [], [])).toEqual({ category: 'Geral', source: 'none', isNew: false });
    });
    it('produto parecido já categorizado manda', () => {
        expect(suggestCategory('Bloco 20 furado', [], [{ name: 'Bloco 20 maciço', category: 'Alvenaria' }]).category).toBe('Alvenaria');
    });
    it('unidade habitual só se existir na lista', () => {
        expect(guessUnit('Cimento 32.5N', ['un', 'saco'])).toBe('saco');
        expect(guessUnit('Cimento', ['un'])).toBe('un');
        expect(guessUnit('Cabo 2.5mm', ['un', 'm'])).toBe('m');
    });
});

describe('planCatalogWrites', () => {
    it('acrescenta ao catálogo o que falta', () => {
        expect(planCatalogWrites({ name: 'Cimento', category: 'Cimento', catalogProducts: [], catalogCategories: [] }))
            .toEqual({ addProduct: true, addCategory: true, category: 'Cimento' });
    });
    it('não duplica produto nem categoria (plural/acentos)', () => {
        expect(planCatalogWrites({ name: 'cimento', category: 'Canalizacao', catalogProducts: [{ name: 'Cimento' }], catalogCategories: ['Canalização'] }))
            .toEqual({ addProduct: false, addCategory: false, category: 'Canalização' });
    });
});
