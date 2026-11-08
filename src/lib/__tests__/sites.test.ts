import { describe, expect, it } from 'vitest';
import { inScope, locationLabel, scopeFor, sitesOf, sortBySite } from '../sites';

const locs = [
    { id: 'l1', name: 'Fábrica', site: 'Matola' },
    { id: 'l2', name: 'Mostruário', site: 'Matola' },
    { id: 'l3', name: 'Loja', site: 'Boane' },
    { id: 'l4', name: 'Armazém' },
];
const company = { isMultiLocation: true, locations: locs };

describe('pontos (sítios)', () => {
    it('lista e ordena por ponto', () => {
        expect(sitesOf(locs)).toEqual(['Boane', 'Matola']);
        expect(sortBySite(locs).map((l) => l.id)).toEqual(['l3', 'l1', 'l2', 'l4']);
        expect(locationLabel(locs[0])).toBe('Matola · Fábrica');
        expect(locationLabel(locs[3])).toBe('Armazém');
    });
    it('o vendedor de um ponto só vê as localizações desse ponto', () => {
        const s = scopeFor({ role: 'Employee', site: 'Matola' }, company)!;
        expect([...s].sort()).toEqual(['l1', 'l2']);
        expect(inScope(s, 'l2')).toBe(true);
        expect(inScope(s, 'l3')).toBe(false);
        // sem local = a primeira localização da empresa
        expect(inScope(s, '', 'l1')).toBe(true);
        expect(inScope(s, 'Principal', 'l3')).toBe(false);
    });
    it('Admin, Dono, quem não tem ponto, ou empresa com um só local: vê tudo', () => {
        expect(scopeFor({ role: 'Admin', site: 'Matola' }, company)).toBeNull();
        expect(scopeFor({ role: 'Dono', site: 'Matola' }, company)).toBeNull();
        expect(scopeFor({ role: 'Employee' }, company)).toBeNull();
        expect(scopeFor({ role: 'Employee', site: 'Matola' }, { ...company, isMultiLocation: false })).toBeNull();
        expect(inScope(null, 'l3')).toBe(true);
    });
    it('ponto sem localizações: não vê stock (nunca vê o dos outros por engano)', () => {
        const s = scopeFor({ role: 'Employee', site: 'Namaacha' }, company)!;
        expect(s.size).toBe(0);
        expect(inScope(s, 'l1', 'l1')).toBe(false);
    });
});

import { siteTotals } from '../sites';
describe('totais por ponto', () => {
    it('soma stock e vendas do mês por ponto', () => {
        const t = siteTotals(locs, [
            { location: 'l1', stock: 10, price: 100 }, { location: 'l2', stock: 1, price: 50 }, { location: 'l3', stock: 2, price: 10 },
            { location: 'Principal', stock: 1, price: 5 }, // sem local = a primeira (l1, Matola)
        ], [{ location: 'l3' }, { location: 'l1' }, { location: 'l4' }], () => 100);
        expect(t).toEqual([
            { site: 'Boane', stockValue: 20, monthSales: 100 },
            { site: 'Matola', stockValue: 1055, monthSales: 100 },
            { site: 'Sem ponto', stockValue: 0, monthSales: 100 },
        ]);
    });
});

import { matchesLocationFilter } from '../sites';
describe('filtro por ponto', () => {
    it('um ponto inteiro, um local, ou tudo', () => {
        expect(matchesLocationFilter('site:Matola', 'l2', locs)).toBe(true);
        expect(matchesLocationFilter('site:Matola', 'l3', locs)).toBe(false);
        expect(matchesLocationFilter('site:Matola', '', locs)).toBe(true); // sem local = a primeira (Matola)
        expect(matchesLocationFilter('l3', 'l3', locs)).toBe(true);
        expect(matchesLocationFilter('all', 'l9', locs)).toBe(true);
    });
});
