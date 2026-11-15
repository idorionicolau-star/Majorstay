import { describe, it, expect } from 'vitest';
import { overnightHoursUntil } from '../hospitality-calc';

// Maputo = UTC+2
const at = (hhmmLocal: string) => new Date(`2026-11-15T${String(Number(hhmmLocal.slice(0, 2)) - 2).padStart(2, '0')}:${hhmmLocal.slice(3)}:00Z`);

describe('pernoite até à hora de saída (10:00)', () => {
  it('chegou às 17:00 → 17h', () => expect(overnightHoursUntil(at('17:00'), 10, 'Africa/Maputo')).toBe(17));
  it('chegou às 22:30 → 12h (arredonda para cima: 11h30)', () => expect(overnightHoursUntil(at('22:30'), 10, 'Africa/Maputo')).toBe(12));
  it('chegou às 02:00 (depois da meia-noite) → 8h até às 10:00 desse dia', () => expect(overnightHoursUntil(at('02:00'), 10, 'Africa/Maputo')).toBe(8));
  it('às 10:00 em ponto → 24h (até ao dia seguinte)', () => expect(overnightHoursUntil(at('10:00'), 10, 'Africa/Maputo')).toBe(24));
  it('hora de saída editável (12:00)', () => expect(overnightHoursUntil(at('17:00'), 12, 'Africa/Maputo')).toBe(19));
  it('hora inválida usa 10:00', () => expect(overnightHoursUntil(at('17:00'), 99, 'Africa/Maputo')).toBe(17));
});
