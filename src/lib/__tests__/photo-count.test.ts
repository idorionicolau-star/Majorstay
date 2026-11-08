import { describe, it, expect } from 'vitest';
import { buildCountPrompt, matchCountRows, parsePastedCount } from '../photo-count';
import type { Product } from '../types';

const p = (name: string, stock = 10) => ({ id: name, instanceId: name, name, stock, reservedStock: 0, unit: 'un', price: 1, category: 'X', location: 'l1' }) as unknown as Product;
const products = [p('Bloco 15x40'), p('Bloco 20x40'), p('Pavê Rectangular'), p('Lancil 1mx12'), p('Grelha 30x30 Flor')];

describe('ler a resposta colada', () => {
  it('aceita os formatos habituais das IAs', () => {
    const rows = parsePastedCount([
      'Aqui está a transcrição:',
      'Bloco 15x40 | 215',
      '- Bloco 20x40: 1.200',
      '| Produto | Quantidade |',
      '|---|---|',
      '| Pavê Rectangular | 12,5 |',
      '**Lancil 1mx12** — 30 un',
      'Grelha 30x30 Flor | ?',
      '7 x Pavê Rectangular',
    ].join('\n'));
    expect(rows.map((r) => [r.name, r.qty])).toEqual([
      ['Bloco 15x40', 215], ['Bloco 20x40', 1200], ['Pavê Rectangular', 12.5], ['Lancil 1mx12', 30], ['Grelha 30x30 Flor', null], ['Pavê Rectangular', 7],
    ]);
  });
});

describe('ligar aos produtos', () => {
  it('nome exacto = certo; números diferentes não se confundem', () => {
    const m = matchCountRows(parsePastedCount('bloco 15x40 | 100\nBloco 20 x 40 | 50'), products);
    expect(m[0]).toMatchObject({ status: 'ok', qty: 100 });
    expect(m[0].product?.name).toBe('Bloco 15x40');
    expect(m[1]).toMatchObject({ status: 'ok' });
    expect(m[1].product?.name).toBe('Bloco 20x40');
  });

  it('quantidade ilegível fica duvidosa; produto desconhecido fica por encontrar', () => {
    const m = matchCountRows(parsePastedCount('Grelha 30x30 Flor | ?\nCimento 32,5 | 40'), products);
    expect(m[0]).toMatchObject({ status: 'doubt', reason: 'Quantidade ilegível' });
    expect(m[1]).toMatchObject({ status: 'missing', product: null });
  });

  it('o mesmo produto em duas linhas soma', () => {
    const m = matchCountRows(parsePastedCount('Pavê Rectangular | 10\nPave rectangular | 5'), products);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ qty: 15, merged: 2 });
  });

  it('erros de escrita pequenos ainda acertam', () => {
    const m = matchCountRows(parsePastedCount('Pave Retangular | 3'), products);
    expect(m[0].product?.name).toBe('Pavê Rectangular');
  });
});

describe('instrução', () => {
  it('leva a lista de produtos e o formato', () => {
    const t = buildCountPrompt(products, 'Estaleiro');
    expect(t).toContain('Nome do produto | quantidade');
    expect(t).toContain('Bloco 15x40');
    expect(t).toContain('"Estaleiro"');
  });
});
