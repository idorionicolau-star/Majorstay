import { describe, it, expect } from 'vitest';
import { normalizeBarcode, looksLikeBarcode, findByBarcode, isValidEan } from '../barcode';
import type { Product } from '../types';

const p = (o: Partial<Product>) => ({ instanceId: o.name, name: 'X', ...o }) as Product;

describe('barcode', () => {
  it('normaliza espaços e hífenes', () => {
    expect(normalizeBarcode(' 5601-234 567890 ')).toBe('5601234567890');
  });
  it('distingue código lido de nome escrito', () => {
    expect(looksLikeBarcode('5601234567890')).toBe(true);
    expect(looksLikeBarcode('bloco 15 x 200')).toBe(false);
    expect(looksLikeBarcode('15')).toBe(false);
    expect(looksLikeBarcode('cimento')).toBe(false);
  });
  it('encontra o produto, mesmo com zero à esquerda a mais (UPC vs EAN)', () => {
    const list = [p({ name: 'Batom', barcode: '012345678905' }), p({ name: 'Sem código' })];
    expect(findByBarcode(list, '0012345678905')?.name).toBe('Batom');
    expect(findByBarcode(list, '999999999999')).toBeUndefined();
  });
  it('prefere o produto do local pedido', () => {
    const list = [p({ name: 'A', barcode: '123456789012', location: 'l1' }), p({ name: 'B', barcode: '123456789012', location: 'l2' })];
    expect(findByBarcode(list, '123456789012', 'l2')?.name).toBe('B');
  });
  it('valida o dígito de controlo EAN', () => {
    expect(isValidEan('4006381333931')).toBe(true);
    expect(isValidEan('4006381333932')).toBe(false);
    expect(isValidEan('abc')).toBe(false);
  });
});
