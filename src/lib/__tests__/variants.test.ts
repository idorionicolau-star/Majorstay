import { describe, it, expect } from 'vitest';
import { cleanOptions, combinations, countCombinations, optionsOfFamily, planVariants, groupFamilies, isFamilyGroup, siblingsOf, variantChoice, variantLabel, variantName, MAX_VARIANTS } from '@/lib/variants';

describe('variações', () => {
    const cor = { name: 'Cor', values: ['Vermelho', 'Cinzento'] };
    const tex = { name: 'Textura', values: ['Lisa', 'Borbulha'] };

    it('limpa espaços, vazios e repetidos', () => {
        const o = cleanOptions([{ name: ' Cor ', values: ['Vermelho', ' vermelho', '', 'Azul'] }, { name: 'cor', values: ['x'] }, { name: 'Vazio', values: [' '] }]);
        expect(o).toEqual([{ name: 'Cor', values: ['Vermelho', 'Azul'] }]);
    });
    it('conta e gera as combinações', () => {
        expect(countCombinations([cor])).toBe(2);
        expect(countCombinations([cor, tex])).toBe(4);
        expect(countCombinations([])).toBe(0);
        expect(combinations([cor, tex])).toHaveLength(4);
        expect(combinations([cor, tex])[1]).toEqual({ Cor: 'Vermelho', Textura: 'Borbulha' });
    });
    it('monta o nome', () => {
        expect(variantName('Pavê Borbulha', { Cor: 'Vermelho' })).toBe('Pavê Borbulha - Vermelho');
        expect(variantName('Camisa', { Textura: 'Lisa', Cor: 'Azul' }, ['Cor', 'Textura'])).toBe('Camisa - Azul / Lisa');
        expect(variantName('Pavê', {})).toBe('Pavê');
    });
    it('planeia só o que ainda não existe', () => {
        const p = planVariants('Pavê', [cor], ['pave - vermelho', 'Outro']);
        expect(p.create.map((v) => v.name)).toEqual(['Pavê - Cinzento']);
        expect(p.existing).toEqual(['Pavê - Vermelho']);
    });
    it('recusa listas enormes', () => {
        const big = [{ name: 'A', values: Array.from({ length: 8 }, (_, i) => `a${i}`) }, { name: 'B', values: Array.from({ length: 8 }, (_, i) => `b${i}`) }];
        expect(countCombinations(big)).toBeGreaterThan(MAX_VARIANTS);
        expect(planVariants('X', big, []).tooMany).toBe(true);
    });
    it('encontra a família e os tipos usados', () => {
        const all = [
            { name: 'Pavê - Vermelho', variantGroup: 'Pavê', variantValues: { Cor: 'Vermelho' } },
            { name: 'Pavê - Azul', variantGroup: 'pavê', variantValues: { Cor: 'Azul' } },
            { name: 'Cimento' },
        ];
        expect(siblingsOf(all[0], all).map((p) => p.name)).toEqual(['Pavê - Azul', 'Pavê - Vermelho']);
        expect(siblingsOf(all[2], all)).toEqual([]);
        expect(optionsOfFamily(all)).toEqual([{ name: 'Cor', values: ['Vermelho', 'Azul'] }]);
    });
});

describe('qual variação? (venda e Stock Rápido)', () => {
    const pool = [
        { name: 'Pavê - Vermelho', variantGroup: 'Pavê', variantValues: { Cor: 'Vermelho' } },
        { name: 'Pavê - Cinzento', variantGroup: 'Pavê', variantValues: { Cor: 'Cinzento' } },
        { name: 'Cimento' },
        { name: 'Bloco - Branco', variantGroup: 'Bloco', variantValues: { Cor: 'Branco' } },
    ];
    it('só o nome da família → pergunta, com todas as variações', () => {
        expect(variantChoice('pave', pool[0], pool).map((p) => p.name)).toEqual(['Pavê - Cinzento', 'Pavê - Vermelho']);
        expect(variantChoice('pa', pool[0], pool)).toHaveLength(2);
    });
    it('a pesquisa já diz qual → não pergunta', () => {
        expect(variantChoice('pave verm', pool[0], pool)).toEqual([]);
    });
    it('sem família ou família de uma só → não pergunta', () => {
        expect(variantChoice('cimento', pool[2], pool)).toEqual([]);
        expect(variantChoice('bloco', pool[3], pool)).toEqual([]);
    });
    it('rótulo da variação', () => {
        expect(variantLabel(pool[0])).toBe('Vermelho');
        expect(variantLabel({ name: 'Pavê - Azul', variantGroup: 'Pavê' })).toBe('Azul');
    });
});

describe('inventário: famílias juntas', () => {
    it('junta as variações da mesma família e localização, no lugar da primeira', () => {
        const list = [
            { name: 'Cimento', location: 'A' },
            { name: 'Pavê - Vermelho', variantGroup: 'Pavê', location: 'A' },
            { name: 'Areia', location: 'A' },
            { name: 'Pavê - Cinzento', variantGroup: 'Pavê', location: 'A' },
            { name: 'Pavê - Azul', variantGroup: 'Pavê', location: 'B' }, // outra localização: sozinho
        ];
        const g = groupFamilies(list);
        expect(g.map((x) => (isFamilyGroup(x) ? `[${x.group}: ${x.members.map((m) => m.name).join(', ')}]` : x.name))).toEqual([
            'Cimento', '[Pavê: Pavê - Cinzento, Pavê - Vermelho]', 'Areia', 'Pavê - Azul',
        ]);
    });
});
