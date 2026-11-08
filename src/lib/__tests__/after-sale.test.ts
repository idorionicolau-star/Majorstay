import { describe, expect, it } from 'vitest';
import { parseAfterSale } from '../after-sale';

describe('parseAfterSale', () => {
    it('só "print" imprime logo; tudo o resto pergunta', () => {
        expect(parseAfterSale('print')).toBe('print');
        expect(parseAfterSale('ask')).toBe('ask');
        expect(parseAfterSale(null)).toBe('ask');
        expect(parseAfterSale('lixo')).toBe('ask');
    });
});
