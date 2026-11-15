/**
 * Hora certa: o relógio do aparelho pode estar adiantado ou atrasado (e fez estadias aparecerem "excedidas" a tempo).
 * O desvio em relação ao servidor é medido de tempos a tempos e aplicado em tudo o que mostra ou calcula tempo de estadia.
 * No servidor o desvio é 0 (o relógio do servidor é a referência).
 */
export const DEFAULT_TIME_ZONE = 'Africa/Maputo';

let offsetMs = 0;
let timeZone = DEFAULT_TIME_ZONE;

/** Desvio (servidor − aparelho) a partir de uma medição: assume que a resposta demorou metade do tempo de ida e volta. */
export function computeOffset(serverNow: number, sentAt: number, receivedAt: number): number {
  return Math.round(serverNow + (receivedAt - sentAt) / 2 - receivedAt);
}

export const setServerOffset = (ms: number) => { offsetMs = Number.isFinite(ms) ? ms : 0; };
export const getServerOffset = () => offsetMs;

/** Agora, pela hora do servidor. */
export const nowMs = (): number => Date.now() + offsetMs;
export const nowDate = (): Date => new Date(nowMs());

export function setHotelTimeZone(tz?: string | null) {
  if (!tz) { timeZone = DEFAULT_TIME_ZONE; return; }
  try { new Intl.DateTimeFormat('pt-MZ', { timeZone: tz }); timeZone = tz; } catch { timeZone = DEFAULT_TIME_ZONE; }
}
export const getHotelTimeZone = () => timeZone;

/** Hora (HH:MM) no fuso do hotel. */
export function formatHotelTime(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit', timeZone });
}

/** Data (DD/MM/AAAA) no fuso do hotel. */
export function formatHotelDate(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone });
}

/** Mede o desvio com o servidor (/api/time). Falhas são ignoradas: mantém o último desvio. */
export async function syncServerTime(): Promise<number> {
  if (typeof window === 'undefined') return offsetMs;
  try {
    const sent = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    const received = Date.now();
    if (!res.ok) return offsetMs;
    const json = await res.json();
    if (typeof json.now === 'number') setServerOffset(computeOffset(json.now, sent, received));
  } catch { /* sem ligação: mantém */ }
  return offsetMs;
}
