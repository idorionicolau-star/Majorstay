import { describe, it, expect } from 'vitest';
import { clampQty, filterCandidates, transferCandidates } from '@/lib/transfer-core';

const products = [
    { name: 'Pavê Saia - Preto', location: 'fab', stock: 50, reservedStock: 10, unit: 'm²' },
    { name: 'Pavê Saia - Branco', location: 'fab', stock: 3, unit: 'm²' },
    { name: 'Pavê Saia - Preto', location: 'loja', stock: 5, unit: 'm²' },
    { name: 'Bloco 15', location: 'fab', stock: 0 },
    { name: 'Lancil', location: 'loja', stock: 9 },
    { name: 'Velho', location: 'fab', stock: 9, deletedAt: '2026-01-01' },
    { name: 'Tampa', location: '', stock: 4 },
];

describe('Transferir stock', () => {
    it('lista só o que há disponível na origem, com o que já está no destino', () => {
        const rows = transferCandidates(products, 'fab', 'loja');
        expect(rows.map((r) => [r.name, r.available, r.atDestination])).toEqual([
            ['Pavê Saia - Branco', 3, 0],
            ['Pavê Saia - Preto', 40, 5],
        ]);
    });
    it('"" e "Principal" são o mesmo local', () => {
        expect(transferCandidates(products, 'Principal', 'loja').map((r) => r.name)).toEqual(['Tampa']);
    });
    it('pesquisa como na Venda Rápida', () => {
        const rows = transferCandidates(products, 'fab', 'loja');
        expect(filterCandidates(rows, 'preto').map((r) => r.name)).toEqual(['Pavê Saia - Preto']);
        expect(filterCandidates(rows, '  ')).toHaveLength(2);
    });
    it('quantidade entre 0 e o disponível', () => {
        expect(clampQty('2,5', 40)).toBe(2.5);
        expect(clampQty(99, 40)).toBe(40);
        expect(clampQty('-1', 40)).toBe(0);
        expect(clampQty('abc', 40)).toBe(0);
    });
});
