/** Estado de urgência dos pedidos dos quartos (para o aviso e o som). */
export type AlertOrder = { id: string; status: string; createdAt?: string; etaAt?: string };

export const ACCEPT_LIMIT_MIN = 3; // pedido por aceitar há mais de 3 min fica destacado
export const ETA_CHOICES = [5, 10, 15, 20] as const;

const ms = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

export type Urgency = 'ok' | 'accept-late' | 'delivery-late';

export function orderUrgency(o: AlertOrder, now: number = Date.now()): Urgency {
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

/** Pedidos que pedem atenção (som a repetir): por aceitar, ou confirmados e atrasados. */
export function attentionCount(orders: AlertOrder[], now: number = Date.now()): { pending: number; late: number } {
  const pending = orders.filter((o) => o.status === 'pending').length;
  const late = orders.filter((o) => orderUrgency(o, now) !== 'ok' && o.status !== 'pending').length;
  return { pending, late };
}

/** Minutos que faltam até à hora prevista (negativo = atrasado). */
export function minutesLeft(etaAt: string | undefined, now: number = Date.now()): number | null {
  const t = ms(etaAt);
  return t === null ? null : Math.ceil((t - now) / 60_000);
}
