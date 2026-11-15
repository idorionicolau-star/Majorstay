import { describe, it, expect } from 'vitest';
import { orderUrgency, attentionCount, minutesLeft } from '../order-alert';

const now = new Date('2026-11-15T10:00:00Z').getTime();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const inMin = (min: number) => new Date(now + min * 60_000).toISOString();

describe('urgência dos pedidos', () => {
  it('pendente há pouco = ok; há mais de 3 min = por aceitar', () => {
    expect(orderUrgency({ id: '1', status: 'pending', createdAt: ago(2) }, now)).toBe('ok');
    expect(orderUrgency({ id: '1', status: 'pending', createdAt: ago(4) }, now)).toBe('accept-late');
  });
  it('confirmado dentro do prazo = ok; passado o tempo = atrasado', () => {
    expect(orderUrgency({ id: '1', status: 'confirmed', etaAt: inMin(3) }, now)).toBe('ok');
    expect(orderUrgency({ id: '1', status: 'confirmed', etaAt: ago(1) }, now)).toBe('delivery-late');
  });
  it('entregue ou recusado nunca alerta', () => {
    expect(orderUrgency({ id: '1', status: 'delivered', etaAt: ago(30) }, now)).toBe('ok');
  });
  it('conta pendentes e atrasados', () => {
    const r = attentionCount([
      { id: 'a', status: 'pending', createdAt: ago(1) },
      { id: 'b', status: 'confirmed', etaAt: ago(2) },
      { id: 'c', status: 'confirmed', etaAt: inMin(5) },
    ], now);
    expect(r).toEqual({ pending: 1, late: 1 });
  });
  it('minutos que faltam', () => {
    expect(minutesLeft(inMin(4), now)).toBe(4);
    expect(minutesLeft(ago(2), now)).toBe(-2);
    expect(minutesLeft(undefined, now)).toBeNull();
  });
});
