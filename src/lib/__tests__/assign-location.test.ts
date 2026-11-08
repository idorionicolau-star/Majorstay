import { describe, it, expect } from 'vitest';
import { planAssignLocation, unassignedProducts } from '@/lib/assign-location';

const all = [
    { id: 'a', name: 'Cimento', location: '', stock: 10 },
    { id: 'b', name: 'Areia', location: 'Principal', stock: 5, reservedStock: 1 },
    { id: 'c', name: 'Bloco', location: 'L1', stock: 7 },
    { id: 'd', name: 'areia', location: 'L1', stock: 2 },
    { id: 'e', name: 'Tinta', location: '', stock: 3, deletedAt: '2026-01-01' },
    { id: 'f', name: 'Bloco', location: 'velho-id', stock: 4 },
];

describe('produtos sem localização', () => {
    it('são os que não estão em nenhum local da empresa (sem contar a lixeira)', () => {
        expect(unassignedProducts(all, ['L1', 'L2']).map((p) => p.id)).toEqual(['a', 'b', 'f']);
    });
    it('pôr num local: muda o local; se já lá houver o mesmo produto, junta o stock', () => {
        const sel = unassignedProducts(all, ['L1', 'L2']);
        expect(planAssignLocation(sel, all, 'L1')).toEqual({
            moves: ['a'],
            merges: [
                { fromId: 'b', intoId: 'd', stock: 5, reserved: 1 },
                { fromId: 'f', intoId: 'c', stock: 4, reserved: 0 },
            ],
        });
    });
    it('num local vazio: só muda o local (e dois iguais juntam-se entre si)', () => {
        const sel = [{ id: 'x', name: 'Cimento', location: '', stock: 1 }, { id: 'y', name: 'cimento', location: 'Principal', stock: 2 }];
        expect(planAssignLocation(sel, sel, 'L2')).toEqual({ moves: ['x'], merges: [{ fromId: 'y', intoId: 'x', stock: 2, reserved: 0 }] });
    });
});
