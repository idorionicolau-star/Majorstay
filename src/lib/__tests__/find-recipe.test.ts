import { describe, it, expect } from 'vitest';
import { findRecipe } from '@/lib/production-materials';

describe('findRecipe', () => {
    const recipes = [{ productName: 'Pavê Borbulha', id: 1 }, { productName: 'Cimento', id: 2 }];
    it('ignora acentos, maiúsculas e espaços a mais', () => {
        expect(findRecipe(recipes, 'pave  borbulha')?.id).toBe(1);
        expect(findRecipe(recipes, ' CIMENTO ')?.id).toBe(2);
    });
    it('não inventa receitas', () => {
        expect(findRecipe(recipes, 'Areia')).toBeUndefined();
        expect(findRecipe(undefined, 'Cimento')).toBeUndefined();
    });
});
