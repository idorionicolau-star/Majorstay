import { describe, it, expect } from 'vitest';
import { readyDate, curingBatches, curingQty, readyQty, allocatePickups } from '../curing';

const at = (s: string) => new Date(`${s}T12:00:00`);

describe('curing', () => {
  it('pronto = dia da produção + dias de secagem (início do dia)', () => {
    const d = readyDate('2026-10-01', 3);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 10, 4]);
  });

  it('só conta lotes que ainda não estão prontos, ignora apagados', () => {
    const now = at('2026-10-03');
    const b = curingBatches([
      { productName: 'Bloco', quantity: 100, date: '2026-10-01' }, // pronto a 4/10 → ainda seca
      { productName: 'Bloco', quantity: 50, date: '2026-09-28' }, // pronto a 1/10 → pronto
      { productName: 'Bloco', quantity: 30, date: '2026-10-02', deletedAt: 'x' },
    ], now, 3);
    expect(b).toHaveLength(1);
    expect(curingQty(b, 'bloco')).toBe(100);
  });

  it('sem dias de secagem não há nada a secar (comércio / não configurado)', () => {
    expect(curingBatches([{ productName: 'A', quantity: 5, date: '2026-10-03' }], at('2026-10-03'), 0)).toEqual([]);
  });

  it('pronto a carregar = stock menos o que seca, nunca negativo', () => {
    const b = curingBatches([{ productName: 'Bloco', quantity: 100, date: '2026-10-02' }], at('2026-10-03'), 3);
    expect(readyQty(500, b, 'Bloco')).toBe(400);
    expect(readyQty(60, b, 'Bloco')).toBe(0);
  });

  it('locais diferentes não se misturam', () => {
    const b = curingBatches([{ productName: 'Bloco', quantity: 100, date: '2026-10-02', location: 'prod' }], at('2026-10-03'), 3);
    expect(curingQty(b, 'Bloco', 'prod')).toBe(100);
    expect(curingQty(b, 'Bloco', 'loja')).toBe(0);
  });

  it('vendas por levantar: as antigas ficam com o que está pronto, as novas esperam', () => {
    const now = at('2026-10-03');
    const batches = curingBatches([
      { productName: 'Bloco', quantity: 100, date: '2026-10-02' }, // pronto 5/10
      { productName: 'Bloco', quantity: 100, date: '2026-10-03' }, // pronto 6/10
    ], now, 3);
    // stock 300: 100 prontos + 200 a secar
    const r = allocatePickups(
      [
        { id: 's1', productName: 'Bloco', quantity: 80, date: '2026-09-30' },
        { id: 's2', productName: 'Bloco', quantity: 80, date: '2026-10-01' },
        { id: 's3', productName: 'Bloco', quantity: 100, date: '2026-10-02' },
        { id: 's4', productName: 'Bloco', quantity: 100, date: '2026-10-02T15:00:00' },
      ],
      () => 300,
      batches,
    );
    expect(r.get('s1')).toEqual({ state: 'ready' });
    const s2 = r.get('s2');
    expect(s2?.state).toBe('curing');
    expect(s2 && s2.state === 'curing' && s2.readyAt.getDate()).toBe(5);
    const s3 = r.get('s3');
    expect(s3 && s3.state === 'curing' && s3.readyAt.getDate()).toBe(6);
    // 80+80+100+100 = 360 > 300 em stock: falta produzir
    expect(r.get('s4')).toEqual({ state: 'short' });
  });
});

describe('local "Principal" = sem local', () => {
  it('a venda sem local encontra o stock em "Principal" (e o que seca lá)', () => {
    const now = new Date(2026, 0, 10);
    const batches = curingBatches([{ productName: 'Grelha', quantity: 5, date: '2026-01-09', location: 'Principal' }], now, 3);
    const stock = (_n: string, l?: string) => (!l || l === 'Principal' ? 314 : 0);
    const out = allocatePickups([{ id: 's1', productName: 'Grelha', quantity: 6, date: '2026-01-10', location: '' }], stock, batches);
    expect(out.get('s1')).toEqual({ state: 'ready' });
    expect(curingQty(batches, 'grelha', '')).toBe(5);
    expect(curingQty(batches, 'grelha', 'Principal')).toBe(5);
  });
});
