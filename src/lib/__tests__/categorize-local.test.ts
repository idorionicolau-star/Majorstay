import { describe, it, expect } from 'vitest';
import { categorizeLocally, matchExistingCategory } from '../categorize-local';

describe('categorizeLocally', () => {
    it('usa palavras-chave de materiais de construção', () => {
        expect(categorizeLocally('Cimento 32.5N', [], [])).toEqual({ category: 'Cimento', source: 'keyword' });
        expect(categorizeLocally('Tinta branca 20L', [], [])?.category).toBe('Tintas');
        expect(categorizeLocally('Vara de ferro 12mm', [], [])?.category).toBe('Ferro');
    });

    it('reaproveita a categoria existente (plural/acentos)', () => {
        expect(categorizeLocally('Bloco 15', ['Blocos'], [])?.category).toBe('Blocos');
        expect(matchExistingCategory('Pre-fabricados', ['Pré-fabricados'])).toBe('Pré-fabricados');
        expect(matchExistingCategory('Canalizacao', ['Canalização'])).toBe('Canalização');
    });

    it('produtos parecidos têm prioridade sobre palavras-chave', () => {
        const products = [{ name: 'Bloco 20 maciço', category: 'Alvenaria' }];
        expect(categorizeLocally('Bloco 20 furado', [], products)).toEqual({ category: 'Alvenaria', source: 'similar' });
    });

    it('sem pistas devolve null (a IA pode tentar)', () => {
        expect(categorizeLocally('Xyzzy', [], [])).toBeNull();
        expect(categorizeLocally('', [], [])).toBeNull();
    });

    it('ignora "Sem categoria" nos produtos de referência', () => {
        const products = [{ name: 'Cola especial', category: 'Sem categoria' }];
        expect(categorizeLocally('Cola especial', [], products)?.source).toBe('keyword');
    });
});
