import { describe, it, expect } from 'vitest';
import { roomRateLabel } from '@/lib/room-rate-label';

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('roomRateLabel', () => {
  it('mínimo de 2h: preço por bloco, nunca "/hora"', () => {
    const t = norm(roomRateLabel(1000, 2));
    expect(t).toContain('a cada 2h');
    expect(t).not.toContain('/hora');
  });
  it('sem mínimo: por hora', () => {
    expect(norm(roomRateLabel(650, 1))).toContain('/hora');
    expect(norm(roomRateLabel(650, undefined))).toContain('/hora');
    expect(norm(roomRateLabel(650, 1, true))).toContain('/h');
    expect(norm(roomRateLabel(650, 1, true))).not.toContain('/hora');
  });
  it('mínimo 3h e 2.5h (arredonda para baixo, como o check-in)', () => {
    expect(roomRateLabel(900, 3)).toContain('a cada 3h');
    expect(roomRateLabel(900, 2.5)).toContain('a cada 2h');
  });
});
