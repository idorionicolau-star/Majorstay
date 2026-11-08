// Relógio do teste de convidado (30 minutos). É o servidor que o guarda, por IP (ver /api/guest-trial), para que limpar o
// browser ou abrir outro, na mesma rede, não dê tempo novo. Aqui só há a regra, sem rede nem base de dados: o servidor
// e os testes usam as mesmas funções.
//
// Só conta o tempo lá dentro. Uma sessão tem um início (`sessionStart`) e um "ainda cá estou" (`lastBeat`, o batimento
// que a app envia de poucos em poucos segundos). Se o batimento pára há mais de GAP_MS (fechou o separador, foi-se a
// rede), a sessão acaba no último batimento: o tempo parado não conta.

export const GUEST_TRIAL_LIMIT_MS = 30 * 60 * 1000;
/** Sem batimento há mais do que isto = a sessão acabou no último batimento. */
export const GUEST_TRIAL_GAP_MS = 60 * 1000;

export type GuestTrialState = {
  /** Tempo já gasto em sessões acabadas. */
  usedMs: number;
  /** Quando começou a sessão a decorrer (null = não há). */
  sessionStart: number | null;
  /** Último "ainda cá estou" dessa sessão. */
  lastBeat: number | null;
};

export type GuestTrialAction = "status" | "start" | "ping" | "end";
export const GUEST_TRIAL_ACTIONS: GuestTrialAction[] = ["status", "start", "ping", "end"];

export const EMPTY_GUEST_TRIAL: GuestTrialState = { usedMs: 0, sessionStart: null, lastBeat: null };

const clampUsed = (n: number) => Math.min(GUEST_TRIAL_LIMIT_MS, Math.max(0, Number.isFinite(n) ? n : 0));

/** Lê o que veio da base de dados (campos em falta ou estragados valem "nada gasto"). */
export function parseGuestTrial(raw: unknown): GuestTrialState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const start = num(r.sessionStart);
  return {
    usedMs: clampUsed(num(r.usedMs) ?? 0),
    sessionStart: start,
    lastBeat: start === null ? null : num(r.lastBeat) ?? start,
  };
}

/** Se a sessão a decorrer ficou sem batimentos, fecha-a no último batimento. */
export function settle(s: GuestTrialState, now: number): GuestTrialState {
  if (s.sessionStart === null) return { usedMs: clampUsed(s.usedMs), sessionStart: null, lastBeat: null };
  const last = s.lastBeat ?? s.sessionStart;
  if (now - last > GUEST_TRIAL_GAP_MS) {
    return { usedMs: clampUsed(s.usedMs + Math.max(0, last - s.sessionStart)), sessionStart: null, lastBeat: null };
  }
  return { usedMs: clampUsed(s.usedMs), sessionStart: s.sessionStart, lastBeat: last };
}

/** Quanto já se gastou, contando a sessão que está a decorrer até agora. */
export function usedNow(s: GuestTrialState, now: number): number {
  return clampUsed(s.usedMs + (s.sessionStart !== null ? Math.max(0, now - s.sessionStart) : 0));
}

export type GuestTrialResult = { state: GuestTrialState; remainingMs: number; allowed: boolean };

/** Fecha tudo: o tempo acabou. */
const exhausted = (): GuestTrialState => ({ usedMs: GUEST_TRIAL_LIMIT_MS, sessionStart: null, lastBeat: null });

export function applyGuestTrial(prev: GuestTrialState, action: GuestTrialAction, now: number): GuestTrialResult {
  let s = settle(prev, now);
  const remaining = () => GUEST_TRIAL_LIMIT_MS - usedNow(s, now);

  if (remaining() <= 0) {
    s = exhausted();
    return { state: s, remainingMs: 0, allowed: false };
  }

  switch (action) {
    case "status":
      break;
    case "start":
    case "ping":
      if (s.sessionStart === null) s = { ...s, sessionStart: now, lastBeat: now };
      else s = { ...s, lastBeat: now };
      break;
    case "end":
      if (s.sessionStart !== null) s = { usedMs: usedNow(s, now), sessionStart: null, lastBeat: null };
      break;
  }

  const left = Math.max(0, GUEST_TRIAL_LIMIT_MS - usedNow(s, now));
  if (left <= 0) return { state: exhausted(), remainingMs: 0, allowed: false };
  return { state: s, remainingMs: left, allowed: true };
}

// -----------------------------------------------------------------------------
// Aparelhos por rede (IP)
// -----------------------------------------------------------------------------
// O tempo conta POR APARELHO (código guardado no aparelho e num cookie). Limpar os dados do browser dá um aparelho novo,
// por isso a rede (IP) só deixa abrir um número limitado deles: não dá para reiniciar o teste para sempre. E, como nas
// redes móveis muita gente partilha o mesmo IP, uma pessoa nunca gasta o tempo das outras: só o número de aparelhos conta.

/** Quantos aparelhos diferentes uma mesma rede pode abrir (pode mudar-se com GUEST_TRIAL_MAX_DEVICES_PER_IP). */
export const GUEST_TRIAL_MAX_DEVICES_PER_IP = 10;

export type DeviceRegistration = { devices: string[]; allowed: boolean; changed: boolean };

/** Regista o aparelho nesta rede. Um aparelho já conhecido passa sempre; um novo só se ainda houver lugar. */
export function registerDevice(known: unknown, deviceId: string, max: number = GUEST_TRIAL_MAX_DEVICES_PER_IP): DeviceRegistration {
  const devices = Array.isArray(known) ? known.filter((d): d is string => typeof d === "string") : [];
  if (devices.includes(deviceId)) return { devices, allowed: true, changed: false };
  if (devices.length >= max) return { devices, allowed: false, changed: false };
  return { devices: [...devices, deviceId], allowed: true, changed: true };
}

