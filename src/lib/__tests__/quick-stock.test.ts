import { describe, it, expect } from 'vitest';
import { parseQuickInput, toNumber, lineKey } from '../quick-stock';

const names = ['Bloco 15', 'Cimento 32.5N', 'Areia fina'];

describe('quick-stock', () => {
    it('toNumber aceita vírgula decimal e espaços', () => {
        expect(toNumber('1 200,5')).toBe(1200.5);
        expect(Number.isNaN(toNumber('abc'))).toBe(true);
    });

    it('nome completo é nome, não nome + quantidade', () => {
        expect(parseQuickInput('Bloco 15', names)).toEqual({ term: 'Bloco 15', qty: null });
        expect(parseQuickInput('cimento 32', names)).toEqual({ term: 'cimento 32', qty: null });
    });

    it('multiplicadores explícitos', () => {
        expect(parseQuickInput('bloco 15 x 200', names)).toEqual({ term: 'bloco 15', qty: 200 });
        expect(parseQuickInput('200x areia', names)).toEqual({ term: 'areia', qty: 200 });
    });

    it('número no fim ou no início', () => {
        expect(parseQuickInput('tijolo 30', names)).toEqual({ term: 'tijolo', qty: 30 });
        expect(parseQuickInput('30 tijolo', names)).toEqual({ term: 'tijolo', qty: 30 });
        expect(parseQuickInput('tijolo 2,5', names)).toEqual({ term: 'tijolo', qty: 2.5 });
    });

    it('vazio e sem número', () => {
        expect(parseQuickInput('  ', names)).toEqual({ term: '', qty: null });
        expect(parseQuickInput('tijolo', names)).toEqual({ term: 'tijolo', qty: null });
    });

    it('lineKey ignora maiúsculas e acentos', () => {
        expect(lineKey('Cimento ', 'A')).toBe(lineKey('cimento', 'A'));
    });
});
