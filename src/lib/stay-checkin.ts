// Cálculo do check-in feito SEMPRE no servidor, a partir do quarto que o administrador configurou.
// O computador da funcionária só diz que quarto, quantas horas e que pacote; o preço nunca vem de lá.
import { overnightHoursUntil, stayChargeForHours } from '@/lib/hospitality-calc';

type AnyRec = Record<string, any>;

export type CheckInPlan = {
  contractedHours: number;
  blockHours: number;
  ratePerHourApplied: number;
  totalAmountDue: number;
  packageType?: 'pernoite' | 'diaria';
  packagePrice?: number;
  packageHours?: number;
};

/** Máximo de horas de uma estadia por hora (30 dias): evita valores absurdos vindos de um ecrã estragado. */
export const MAX_CONTRACTED_HOURS = 720;

/**
 * Plano do check-in: horas, valor por hora, pacote e total, tudo do quarto + hora do servidor.
 * Devolve `{ error }` quando o pedido não faz sentido (pacote que o quarto não tem, etc.).
 */
export function planCheckIn(
  room: AnyRec,
  input: { contractedHours?: unknown; packageType?: unknown },
  now: Date,
  timeZone = 'Africa/Maputo'
): CheckInPlan | { error: string } {
  const roomRate = Math.max(0, Number(room.ratePerHour) || 0);
  const blockHours = Math.max(1, Math.floor(Number(room.minimumHours) || 1));
  const ratePerHourApplied = roomRate / blockHours;

  if (input.packageType === 'pernoite' || input.packageType === 'diaria') {
    const price = Number(input.packageType === 'pernoite' ? room.overnightPrice : room.dailyPrice) || 0;
    if (!(price > 0)) {
      return { error: `Este quarto não tem preço de ${input.packageType === 'pernoite' ? 'pernoite' : 'diária'} configurado.` };
    }
    const hours = input.packageType === 'pernoite' ? overnightHoursUntil(now, room.overnightEndHour, timeZone) : 24;
    const stayLike = { ratePerHourApplied, packagePrice: price, packageHours: hours };
    return {
      contractedHours: hours,
      blockHours,
      ratePerHourApplied,
      packageType: input.packageType,
      packagePrice: price,
      packageHours: hours,
      totalAmountDue: stayChargeForHours(stayLike, hours),
    };
  }

  const requested = Math.ceil(Number(input.contractedHours));
  if (!Number.isFinite(requested) || requested < 1) return { error: 'Horas inválidas: o mínimo é 1 hora.' };
  if (requested > MAX_CONTRACTED_HOURS) return { error: `Horas a mais: o máximo é ${MAX_CONTRACTED_HOURS}.` };
  const billed = Math.ceil(requested / blockHours) * blockHours;
  return {
    contractedHours: billed,
    blockHours,
    ratePerHourApplied,
    totalAmountDue: stayChargeForHours({ ratePerHourApplied }, billed),
  };
}

/** Subscrição suspensa ou período de teste/pagamento acabado: não se abrem estadias (mesmo critério das regras da base de dados). */
export function subscriptionBlocked(company: AnyRec, nowMs: number): boolean {
  const status = company.status ?? 'active';
  if (status === 'suspended' || status === 'inactive') return true;
  const toMs = (v: any): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
    if (typeof v.toMillis === 'function') return v.toMillis();
    return null;
  };
  if (status === 'trial') {
    const ends = toMs(company.trialEndsAt);
    return ends !== null && nowMs >= ends;
  }
  if (status === 'active') {
    const paid = toMs(company.paidUntilMs);
    return typeof company.paidUntilMs === 'number' && paid !== null && nowMs >= paid;
  }
  return false;
}
