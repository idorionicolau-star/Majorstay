import type { StayStatus, StayExtension } from './types';

/**
 * Normaliza qualquer formato de data (Date, ISO string, número ms, Firestore Timestamp) para Date.
 */
export function normalizeDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0));
  }
  if (typeof val === 'number') {
    return new Date(val);
  }
  if (typeof val === 'string') {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}

/**
 * Duração da estadia em minutos completos.
 */
export function calculateDurationMinutes(checkInAt: any, checkOutAt: any = new Date()): number {
  const start = normalizeDate(checkInAt).getTime();
  const end = normalizeDate(checkOutAt).getTime();
  const diffMs = Math.max(0, end - start);
  return Math.floor(diffMs / 60000);
}

/**
 * Calcula as horas a faturar.
 * Regras essenciais de negócio:
 * 1. Mínimo de horas contratadas (não se cobra menos do que o cliente contratou).
 * 2. Hora começada = hora paga (arredondamento para cima após o período de tolerância).
 * 3. Tolerância (graceMinutes, por defeito 2 minutos) para evitar cobrança indevida por mero atraso de registo.
 */
export function calculateBilledHours(
  checkInAt: any,
  checkOutAt: any = new Date(),
  contractedHours: number = 1,
  graceMinutes: number = 2
): number {
  const minContracted = Math.max(1, Math.floor(contractedHours || 1));
  const durationMin = calculateDurationMinutes(checkInAt, checkOutAt);

  // Se a estadia for inferior ou igual à duração contratada (em minutos), fatura o contratado
  const contractedMinutes = minContracted * 60;
  if (durationMin <= contractedMinutes + graceMinutes) {
    return minContracted;
  }

  // Se ultrapassou o contratado + tolerância, cada nova fração de hora conta como hora inteira
  const effectiveMinutes = Math.max(0, durationMin - graceMinutes);
  const calculatedHours = Math.ceil(effectiveMinutes / 60);

  return Math.max(minContracted, calculatedHours);
}

export type StayPricingResult = {
  durationMinutes: number;
  billedHours: number;
  contractedHours: number;
  overtimeHours: number;
  ratePerHour: number;
  totalAmountDue: number;
  isOvertime: boolean;
};

/**
 * Calcula o resumo financeiro completo de uma estadia.
 */
export function calculateStayPricing(params: {
  checkInAt: any;
  checkOutAt?: any;
  contractedHours: number;
  ratePerHour: number;
  graceMinutes?: number;
}): StayPricingResult {
  const { checkInAt, checkOutAt, contractedHours, ratePerHour, graceMinutes = 2 } = params;
  const durationMinutes = calculateDurationMinutes(checkInAt, checkOutAt);
  const billedHours = calculateBilledHours(checkInAt, checkOutAt, contractedHours, graceMinutes);
  const normalizedContracted = Math.max(1, Math.floor(contractedHours || 1));
  const overtimeHours = Math.max(0, billedHours - normalizedContracted);
  const safeRate = Math.max(0, ratePerHour || 0);
  const totalAmountDue = billedHours * safeRate;
  const isOvertime = overtimeHours > 0;

  return {
    durationMinutes,
    billedHours,
    contractedHours: normalizedContracted,
    overtimeHours,
    ratePerHour: safeRate,
    totalAmountDue,
    isOvertime,
  };
}

/**
 * Calcula a data/hora prevista para o fim da estadia com base no check-in e nas horas totais (contratadas + extensões).
 */
export function calculateExpectedCheckOut(
  checkInAt: any,
  contractedHours: number,
  extensions?: StayExtension[]
): Date {
  const startDate = normalizeDate(checkInAt);
  const extensionHours = (extensions || []).reduce((acc, ext) => acc + (Number(ext.hours) || 0), 0);
  const totalHours = Math.max(1, (Number(contractedHours) || 1) + extensionHours);
  return new Date(startDate.getTime() + totalHours * 3600 * 1000);
}

export type StayRealtimeStatus = {
  isOvertime: boolean;
  minutesRemainingOrOverdue: number;
  expectedCheckOut: Date;
  durationMinutes: number;
};

/**
 * Informações de tempo real para o painel de quartos.
 */
export function computeStayRealtimeStatus(params: {
  status: StayStatus;
  checkInAt: any;
  contractedHours: number;
  extensions?: StayExtension[];
  now?: any;
}): StayRealtimeStatus {
  const { status, checkInAt, contractedHours, extensions, now } = params;
  const nowDate = normalizeDate(now);
  const expectedCheckOut = calculateExpectedCheckOut(checkInAt, contractedHours, extensions);
  const durationMinutes = calculateDurationMinutes(checkInAt, nowDate);

  if (status === 'closed' || status === 'cancelled') {
    return {
      isOvertime: false,
      minutesRemainingOrOverdue: 0,
      expectedCheckOut,
      durationMinutes,
    };
  }

  const diffMs = expectedCheckOut.getTime() - nowDate.getTime();
  const minutesDiff = Math.round(diffMs / 60000);

  return {
    isOvertime: minutesDiff < 0,
    minutesRemainingOrOverdue: minutesDiff,
    expectedCheckOut,
    durationMinutes,
  };
}

/**
 * Formata duração em minutos para formato amigável (ex: "45 min", "1h 20 min").
 */
export function formatStayDuration(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${String(mins).padStart(2, '0')} min`;
}

/**
 * Mensagem amigável de tempo restante ou excedido.
 */
export function formatTimeRemaining(minutesDiff: number): string {
  if (minutesDiff > 0) {
    return `Restam ${formatStayDuration(minutesDiff)}`;
  }
  if (minutesDiff === 0) {
    return 'Tempo terminado agora';
  }
  return `Excedido há ${formatStayDuration(Math.abs(minutesDiff))}`;
}
