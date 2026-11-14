import { describe, it, expect } from 'vitest';
import { availableUnits, formatAvailable } from '@/lib/dish-stock';

const raw = { id: 'r1', stock: 10, reservedStock: 0, category: 'Cozinha / Alimentos' };
const dish = (over = {}) => ({ id: 'd1', stock: 999, reservedStock: 0, isDish: true, rawIngredientId: 'r1', rawQuantityPerPortion: 0.3, ...over });

describe('quantidades reais', () => {
  it('produto normal: stock menos reservado', () => {
    expect(availableUnits({ id: 'p', stock: 25, reservedStock: 5 }, [])).toBe(20);
  });
  it('prato: doses dadas pela matéria-prima, ignora o 999', () => {
    expect(availableUnits(dish(), [raw])).toBe(33);
  });
  it('prato com meio frango por dose (unidades)', () => {
    expect(availableUnits(dish({ rawQuantityPerPortion: 0.5 }), [{ ...raw, stock: 4 }])).toBe(8);
  });
  it('prato ao peso: kg que ainda há', () => {
    expect(availableUnits(dish({ soldByWeight: true }), [{ ...raw, stock: 7.5 }])).toBe(7.5);
  });
  it('prato sem matéria-prima ligada: sem número (nada de 999)', () => {
    expect(availableUnits(dish({ rawIngredientId: undefined }), [raw])).toBeNull();
    expect(formatAvailable(null)).toBe('');
  });
  it('matéria-prima apagada: 0 doses', () => {
    expect(availableUnits(dish(), [])).toBe(0);
  });
});
