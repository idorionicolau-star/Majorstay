import { describe, it, expect } from 'vitest';
import { validateDiscount } from '../discount';

describe('validateDiscount', () => {
  it('sem desconto não exige motivo', () => expect(validateDiscount(0, '', 650)).toEqual({ amount: 0, reason: '' }));
  it('valor inválido vira zero', () => expect(validateDiscount('abc', '', 650).amount).toBe(0));
  it('com desconto exige motivo', () => expect(() => validateDiscount(150, '  ', 650)).toThrow(/motivo/));
  it('não pode passar do total', () => expect(() => validateDiscount(700, 'Negociação', 650)).toThrow(/maior/));
  it('aceita desconto com motivo', () => expect(validateDiscount(150, 'Negociação', 650)).toEqual({ amount: 150, reason: 'Negociação' }));
});
