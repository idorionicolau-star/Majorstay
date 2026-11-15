import { describe, it, expect } from 'vitest';
import { cleanClientName, tabTotal } from './tabs';

describe('contas abertas', () => {
  it('soma os itens sem erros de arredondamento', () => {
    expect(tabTotal([{ totalPrice: 0.1 }, { totalPrice: 0.2 }])).toBe(0.3);
    expect(tabTotal([])).toBe(0);
  });
  it('limpa o nome do cliente', () => {
    expect(cleanClientName('  João   da  Silva ')).toBe('João da Silva');
    expect(cleanClientName(undefined)).toBe('');
    expect(cleanClientName('x'.repeat(100))).toHaveLength(60);
  });
});
