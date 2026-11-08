import { describe, it, expect } from 'vitest';
import { analyzeBusiness } from '../business-analysis';
import type { Product } from '../types';

const prods = [{ id: '1', instanceId: '1', name: 'Batom', stock: 0, reservedStock: 0, price: 0, cost: 0, category: 'Make-up', unit: 'un' }] as unknown as Product[];

describe('diagnóstico para comércio (revenda)', () => {
  it('não pede produção nem aponta para /production', () => {
    const a = analyzeBusiness({ products: prods, businessType: 'reseller' });
    expect(a.quality.tasks.some((t) => t.id === 'production')).toBe(false);
    const hrefs = [...a.alerts.map((x) => x.action?.href), ...a.quality.tasks.map((t) => t.action?.href)];
    expect(hrefs.some((h) => h?.startsWith('/production'))).toBe(false);
    expect(a.alerts.find((x) => x.id === 'out')?.detail).not.toMatch(/produ/i);
  });

  it('quem fabrica continua a ver a produção', () => {
    const a = analyzeBusiness({ products: prods, businessType: 'manufacturer' });
    expect(a.quality.tasks.some((t) => t.id === 'production')).toBe(true);
  });
});
