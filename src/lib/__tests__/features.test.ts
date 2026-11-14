import { describe, it, expect } from 'vitest';
import { KITCHEN_ENABLED, isKitchenProduct } from '../features';

describe('cozinha desligada', () => {
  it('está desligada por defeito', () => expect(KITCHEN_ENABLED).toBe(false));
  it('reconhece pratos e matérias-primas', () => {
    expect(isKitchenProduct({ isDish: true })).toBe(true);
    expect(isKitchenProduct({ isKitchenIngredient: true })).toBe(true);
    expect(isKitchenProduct({ category: 'Cozinha / Alimentos' })).toBe(true);
  });
  it('não apanha produtos normais', () => {
    expect(isKitchenProduct({ category: 'Bebidas' })).toBe(false);
    expect(isKitchenProduct(null)).toBe(false);
  });
});
