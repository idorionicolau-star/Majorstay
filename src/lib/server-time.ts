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

/** Uma medição só vale se a resposta foi rápida: com uma resposta atrasada (PC a dormir, separador parado, rede má) a "metade da latência" dá um desvio errado. */
export const MAX_SYNC_RTT_MS = 2000;

export type TimeSample = { offset: number; rtt: number };

/** A melhor medição: a de menor latência, e só se for rápida o bastante. null = nenhuma serve (mantém o desvio que já tinha). */
export function pickBestSample(samples: TimeSample[], maxRtt = MAX_SYNC_RTT_MS): TimeSample | null {
  const ok = samples.filter((s) => Number.isFinite(s.offset) && Number.isFinite(s.rtt) && s.rtt >= 0 && s.rtt <= maxRtt);
  if (!ok.length) return null;
  return ok.reduce((best, s) => (s.rtt < best.rtt ? s : best));
}

/** Mede o desvio com o servidor (/api/time): até 3 medições, fica com a mais rápida. Falhas e respostas lentas são ignoradas: mantém o último desvio. */
export async function syncServerTime(): Promise<number> {
  if (typeof window === 'undefined') return offsetMs;
  const samples: TimeSample[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      const sentPerf = performance.now(); // a latência mede-se com o relógio monotónico (não salta se o relógio do PC for acertado)
      const res = await fetch('/api/time', { cache: 'no-store' });
      const received = Date.now();
      const rtt = performance.now() - sentPerf;
      if (!res.ok) continue;
      const json = await res.json();
      if (typeof json.now === 'number') samples.push({ offset: Math.round(json.now + rtt / 2 - received), rtt });
      if (rtt <= 400) break; // já é boa: não precisa de mais
    } catch { /* sem ligação: tenta a seguinte */ }
  }
  const best = pickBestSample(samples);
  if (best) setServerOffset(best.offset);
  return offsetMs;
}
