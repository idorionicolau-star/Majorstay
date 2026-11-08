import { describe, it, expect } from 'vitest';
import { analyzeBusiness } from '../business-analysis';
import { PRODUCT_PROBLEMS } from '../deep-links';
import type { Product } from '../types';

const base = { stock: 10, reservedStock: 0, price: 100, cost: 50, category: 'Blocos', unit: 'un' };
const prods = [
  { ...base, id: '1', instanceId: '1', name: 'Bloco 15', thresholdMode: 'manual' },
  { ...base, id: '2', instanceId: '2', name: 'Bloco 20', thresholdMode: 'auto' },
  { ...base, id: '3', instanceId: '3', name: 'Pavê' }, // sem modo gravado = automático
] as unknown as Product[];

describe('limites de stock fixos', () => {
  it('o diagnóstico avisa só dos produtos em modo manual e leva ao filtro', () => {
    const al = analyzeBusiness({ products: prods }).alerts.find((x) => x.id === 'manual-thresholds');
    expect(al?.title).toBe('1 produto tem limites de stock fixos');
    expect(al?.items).toEqual(['Bloco 15']);
    expect(al?.action?.href).toBe('/inventory?problema=limites-manuais');
  });

  it('sem modo gravado não conta como manual', () => {
    expect(prods.filter(PRODUCT_PROBLEMS['limites-manuais'].test).map((p) => p.name)).toEqual(['Bloco 15']);
  });

  it('sem produtos manuais não há aviso', () => {
    const a = analyzeBusiness({ products: prods.filter((p) => p.thresholdMode !== 'manual') });
    expect(a.alerts.some((x) => x.id === 'manual-thresholds')).toBe(false);
  });
});
