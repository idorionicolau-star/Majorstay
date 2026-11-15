import { describe, it, expect } from 'vitest';
import { dishAvailable, dishDayKey, isDishRef, dishIdOf } from '../dishes';

const at = (iso: string) => new Date(iso);
describe('pratos do dia', () => {
  it('o dia vira às 05:00 de Maputo (03:00 UTC)', () => {
    expect(dishDayKey(at('2026-11-15T02:59:00Z'))).toBe('2026-11-14');
    expect(dishDayKey(at('2026-11-15T03:00:00Z'))).toBe('2026-11-15');
  });
  it('quantidade só vale no próprio dia', () => {
    const now = at('2026-11-15T10:00:00Z');
    expect(dishAvailable({ available: 8, availableDay: '2026-11-15' }, now)).toBe(8);
    expect(dishAvailable({ available: 8, availableDay: '2026-11-14' }, now)).toBe(0);
  });
  it('esgotado, inativo ou apagado = 0', () => {
    const now = at('2026-11-15T10:00:00Z');
    expect(dishAvailable({ available: 0, availableDay: '2026-11-15' }, now)).toBe(0);
    expect(dishAvailable({ available: 5, availableDay: '2026-11-15', active: false }, now)).toBe(0);
    expect(dishAvailable({ available: 5, availableDay: '2026-11-15', deletedAt: 'x' }, now)).toBe(0);
    expect(dishAvailable(null, now)).toBe(0);
  });
  it('referências', () => {
    expect(isDishRef('dish:abc')).toBe(true);
    expect(isDishRef('abc')).toBe(false);
    expect(dishIdOf('dish:abc')).toBe('abc');
  });
});
