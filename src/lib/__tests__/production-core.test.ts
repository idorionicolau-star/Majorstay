import { describe, it, expect } from 'vitest';
import { catalogChoices, checkNewMaterial, dateLabel, mostProduced, todayMz, validProductionDate, yesterdayMz } from '@/lib/production-core';
import { isFamilyGroup } from '@/lib/variants';

const now = new Date('2026-10-14T23:30:00Z'); // já é dia 15 em Maputo

describe('Produção: datas', () => {
    it('hoje e ontem em Maputo', () => {
        expect(todayMz(now)).toBe('2026-10-15');
        expect(yesterdayMz(now)).toBe('2026-10-14');
        expect(dateLabel('2026-10-15', now)).toBe('hoje');
        expect(dateLabel('2026-10-14', now)).toBe('ontem');
        expect(dateLabel('2026-10-01', now)).toBe('01/10/2026');
    });
    it('não no futuro, no máximo um ano atrás', () => {
        expect(validProductionDate('2026-10-15', now)).toBe(true);
        expect(validProductionDate('2026-10-16', now)).toBe(false);
        expect(validProductionDate('2025-09-01', now)).toBe(false);
        expect(validProductionDate('15/10/2026', now)).toBe(false);
    });
});

describe('Produção: escolher no catálogo', () => {
    const catalog = [
        { name: 'Pavê Saia - Preto', variantGroup: 'Pavê Saia' },
        { name: 'Pavê Saia - Branco', variantGroup: 'Pavê Saia' },
        { name: 'Bloco 15' },
        { name: 'Lancil' },
    ];
    it('sem texto: tudo, com as variações juntas por família', () => {
        const c = catalogChoices(catalog, '');
        expect(c.map((x) => (isFamilyGroup(x) ? `fam:${x.group}(${x.members.length})` : x.name))).toEqual(['Bloco 15', 'Lancil', 'fam:Pavê Saia(2)']);
    });
    it('pesquisa como na Venda Rápida', () => {
        expect(catalogChoices(catalog, 'bloco').map((x) => (isFamilyGroup(x) ? x.group : x.name))).toEqual(['Bloco 15']);
        const pave = catalogChoices(catalog, 'pave');
        expect(pave).toHaveLength(1);
        expect(isFamilyGroup(pave[0])).toBe(true);
        // a pesquisa já diz qual variação: aparece só essa
        expect(catalogChoices(catalog, 'pave preto').map((x) => (isFamilyGroup(x) ? x.group : x.name))).toEqual(['Pavê Saia - Preto']);
    });
    it('mais produzidos (últimos 60 dias, ainda no catálogo)', () => {
        const prods = [
            { productName: 'Bloco 15', date: '2026-10-10' }, { productName: 'Bloco 15', date: '2026-10-11' },
            { productName: 'Lancil', date: '2026-10-12' }, { productName: 'Velho', date: '2026-10-12' },
            { productName: 'Lancil', date: '2026-01-01' }, { productName: 'Lancil', date: '2026-10-13', deletedAt: 'x' },
        ];
        expect(mostProduced(prods, new Set(catalog.map((c) => c.name)), 6, now)).toEqual(['Bloco 15', 'Lancil']);
    });
});

import { cleanMaterials, materialDelta, recipeMaterials, wasteHint } from '@/lib/production-core';

describe('Produção: matéria-prima usada', () => {
    const recipe = { ingredients: [
        { rawMaterialId: 'cim', rawMaterialName: 'Cimento', quantity: 1, yieldPerUnit: 75 },
        { rawMaterialId: 'are', rawMaterialName: 'Areia', quantity: 0.02 },
    ] };
    it('a receita dá o ponto de partida (sacos arredondados para cima)', () => {
        expect(recipeMaterials(recipe, 150, [{ id: 'cim', unit: 'saco' }])).toEqual([
            { rawMaterialId: 'cim', name: 'Cimento', quantity: 2, unit: 'saco' },
            { rawMaterialId: 'are', name: 'Areia', quantity: 3, unit: undefined },
        ]);
        expect(recipeMaterials(undefined, 10)).toEqual([]);
    });
    it('junta repetidas e tira as linhas a zero', () => {
        expect(cleanMaterials([
            { rawMaterialId: 'cim', name: 'Cimento', quantity: 2 },
            { rawMaterialId: 'cim', name: 'Cimento', quantity: 1.5 },
            { rawMaterialId: 'are', name: 'Areia', quantity: 0 },
            { rawMaterialId: '', name: 'x', quantity: 4 },
        ])).toEqual([{ rawMaterialId: 'cim', name: 'Cimento', quantity: 3.5 }]);
    });
    it('ao editar: o que volta e o que sai a mais', () => {
        const d = materialDelta(
            [{ rawMaterialId: 'cim', name: 'Cimento', quantity: 2 }, { rawMaterialId: 'are', name: 'Areia', quantity: 3 }],
            [{ rawMaterialId: 'cim', name: 'Cimento', quantity: 3 }, { rawMaterialId: 'cal', name: 'Cal', quantity: 1 }],
        );
        expect(Object.fromEntries(d)).toEqual({ cim: -1, are: 3, cal: -1 });
        expect(materialDelta([{ rawMaterialId: 'cim', name: 'C', quantity: 2 }], [{ rawMaterialId: 'cim', name: 'C', quantity: 2 }]).size).toBe(0);
    });
});

describe('checkNewMaterial (matéria-prima criada na produção)', () => {
    const existing = [{ id: 'm1', name: 'Areia Grossa' }, { id: 'm2', name: 'Cimento' }];
    it('cria com nome, unidade e o stock de agora', () => {
        expect(checkNewMaterial({ name: '  pedra   britada ', unit: 'm³', stock: '12,5' }, existing))
            .toEqual({ kind: 'ok', value: { name: 'Pedra britada', unit: 'm³', stock: 12.5 } });
        expect(checkNewMaterial({ name: 'Saco', unit: '', stock: '0' }, existing)).toEqual({ kind: 'ok', value: { name: 'Saco', unit: 'un', stock: 0 } });
    });
    it('não repete: o mesmo nome (sem acentos/maiúsculas) usa a que existe', () => {
        expect(checkNewMaterial({ name: 'areia  grossa', unit: 'kg', stock: '5' }, existing)).toEqual({ kind: 'existing', id: 'm1', name: 'Areia Grossa' });
    });
    it('pede o nome e um stock válido', () => {
        expect(checkNewMaterial({ name: 'a', unit: 'un', stock: '1' }, existing).kind).toBe('error');
        expect(checkNewMaterial({ name: 'Tinta', unit: 'un', stock: '' }, existing).kind).toBe('error');
        expect(checkNewMaterial({ name: 'Tinta', unit: 'un', stock: '-2' }, existing).kind).toBe('error');
    });
});

describe('aviso de desperdício (material aberto para poucas unidades)', () => {
    const recipe = { ingredients: [{ rawMaterialId: 'c', rawMaterialName: 'Cimento', quantity: 1, yieldPerUnit: 75 }, { rawMaterialId: 'a', rawMaterialName: 'Areia', quantity: 0.01 }] };
    it('80 blocos abrem um 2.º saco que dá para 150', () => {
        expect(wasteHint(recipe, 80, [{ id: 'c', name: 'Cimento 32,5', unit: 'saco' }])).toMatchObject({ material: 'Cimento 32,5', used: 2, unit: 'saco', capacity: 150 });
    });
    it('sem desperdício que valha a pena, não diz nada', () => {
        expect(wasteHint(recipe, 75)).toBeNull();
        expect(wasteHint(recipe, 140)).toBeNull(); // 7% de sobra
        expect(wasteHint({ ingredients: [{ rawMaterialId: 'a', rawMaterialName: 'Areia', quantity: 2 }] }, 5)).toBeNull();
    });
});
