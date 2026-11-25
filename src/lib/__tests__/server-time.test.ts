import { describe, it, expect, beforeEach } from 'vitest';
import { computeOffset, setServerOffset, nowMs, formatHotelTime, setHotelTimeZone, pickBestSample } from '../server-time';

describe('hora do servidor', () => {
  beforeEach(() => { setServerOffset(0); setHotelTimeZone(); });
  it('aparelho atrasado 5 min: desvio positivo', () => {
    // aparelho a 10:00:00, servidor a 10:05:00, resposta instantânea
    expect(computeOffset(10 * 3600_000 + 5 * 60_000, 10 * 3600_000, 10 * 3600_000)).toBe(5 * 60_000);
  });
  it('aparelho adiantado: desvio negativo; metade da latência é compensada', () => {
    expect(computeOffset(1_000_000, 1_000_100, 1_000_300)).toBe(1_000_000 + 100 - 1_000_300);
  });
  it('nowMs aplica o desvio', () => {
    setServerOffset(60_000);
    expect(Math.abs(nowMs() - (Date.now() + 60_000))).toBeLessThan(50);
  });
  it('mostra a hora no fuso de Maputo (UTC+2) e aceita outro fuso', () => {
    const d = new Date('2026-11-15T10:00:00Z');
    expect(formatHotelTime(d)).toBe('12:00');
    setHotelTimeZone('Africa/Lagos');
    expect(formatHotelTime(d)).toBe('11:00');
    setHotelTimeZone('fuso-invalido');
    expect(formatHotelTime(d)).toBe('12:00');
  });
});

describe('medição do desvio', () => {
  it('uma resposta atrasada daria um desvio errado (é o que se descarta)', () => {
    // servidor responde logo, mas a resposta só chega 38 min depois: a "metade da latência" dá -19 min
    const T = 1_000_000_000_000;
    expect(computeOffset(T, T, T + 38 * 60_000)).toBe(-19 * 60_000);
  });
  it('descarta medições lentas e fica com a mais rápida', () => {
    expect(pickBestSample([{ offset: -1_140_000, rtt: 2_280_000 }])).toBeNull();
    expect(pickBestSample([{ offset: 5000, rtt: 900 }, { offset: 4200, rtt: 120 }, { offset: -99, rtt: 5000 }])).toEqual({ offset: 4200, rtt: 120 });
    expect(pickBestSample([])).toBeNull();
  });
});
