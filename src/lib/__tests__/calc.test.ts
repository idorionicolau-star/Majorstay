import { describe, it, expect } from 'vitest';
import { evalQty, isExpression, prettyExpression } from '@/lib/calc';

describe('calculadora das quantidades', () => {
    it('somas, subtracções, multiplicações e divisões', () => {
        expect(evalQty('120+35+48')).toBe(203);
        expect(evalQty('12x8+5')).toBe(101);
        expect(evalQty('12 × 8 + 5')).toBe(101);
        expect(evalQty('2,5*4')).toBe(10);
        expect(evalQty('(10+2)*3')).toBe(36);
        expect(evalQty('100-15')).toBe(85);
        expect(evalQty('9/2')).toBe(4.5);
        expect(evalQty('0,1+0,2')).toBe(0.3);
    });
    it('um número simples também serve', () => {
        expect(evalQty('42')).toBe(42);
        expect(evalQty('1,5')).toBe(1.5);
    });
    it('contas inválidas dão NaN', () => {
        expect(evalQty('')).toBeNaN();
        expect(evalQty('12+')).toBeNaN();
        expect(evalQty('abc')).toBeNaN();
        expect(evalQty('5/0')).toBeNaN();
        expect(evalQty('(3+2')).toBeNaN();
    });
    it('reconhece uma conta e mostra as parcelas', () => {
        expect(isExpression('120+35')).toBe(true);
        expect(isExpression('12x8')).toBe(true);
        expect(isExpression('120')).toBe(false);
        expect(isExpression('-5')).toBe(false);
        expect(prettyExpression('120+35+48')).toBe('120 + 35 + 48');
        expect(prettyExpression('12x8+5')).toBe('12 × 8 + 5');
    });
});
