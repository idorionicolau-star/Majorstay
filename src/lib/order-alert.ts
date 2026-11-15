import { nowMs } from '@/lib/server-time';
/** Estado de urgência dos pedidos dos quartos (para o aviso e o som). */
export type AlertOrder = { id: string; status: string; createdAt?: string; etaAt?: string };

export const ACCEPT_LIMIT_MIN = 3; // pedido por aceitar há mais de 3 min fica destacado
export const ETA_CHOICES = [5, 10, 15, 20, 30, 45, 60] as const;

const ms = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

export type Urgency = 'ok' | 'accept-late' | 'delivery-late';

export function orderUrgency(o: AlertOrder, now: number = nowMs()): Urgency {
  if (o.status === 'pending') {
    const t = ms(o.createdAt);
    return t !== null && now - t > ACCEPT_LIMIT_MIN * 60_000 ? 'accept-late' : 'ok';
  }
  if (o.status === 'confirmed') {
    const t = ms(o.etaAt);
    return t !== null && now > t ? 'delivery-late' : 'ok';
  }
  return 'ok';
}

/** Pedidos que pedem atenção (som a repetir): por aceitar, por confirmar (> 3 min), ou confirmados e atrasados. */
export function attentionCount(orders: AlertOrder[], now: number = nowMs()): { pending: number; late: number; unconfirmed: number } {
  const pending = orders.filter((o) => o.status === 'pending').length;
  const unconfirmed = orders.filter((o) => o.status === 'pending' && orderUrgency(o, now) === 'accept-late').length;
  const late = orders.filter((o) => orderUrgency(o, now) === 'delivery-late' && o.status === 'confirmed').length;
  return { pending, late, unconfirmed };
}

/** Minutos que faltam até à hora prevista (negativo = atrasado). */
export function minutesLeft(etaAt: string | undefined, now: number = nowMs()): number | null {
  const t = ms(etaAt);
  return t === null ? null : Math.ceil((t - now) / 60_000);
}
