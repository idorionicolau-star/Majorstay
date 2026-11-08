// Fala com /api/guest-trial (o relógio do convidado guardado no servidor, ver lib/guest-trial.ts).
// Qualquer falha de rede devolve `null`: a app continua com o relógio do aparelho e nunca fica presa à espera.
import { getGuestDeviceId } from "@/lib/guest-mode";
import type { GuestTrialAction } from "@/lib/guest-trial";

export type GuestTrialReply = {
  /** O servidor está a seguir o tempo (false = só vale o relógio do aparelho). */
  tracked: boolean;
  allowed: boolean;
  remainingMs: number;
  reason?: "time" | "network";
};

const TIMEOUT_MS = 8000;

async function call(action: GuestTrialAction, keepalive = false): Promise<GuestTrialReply | null> {
  if (typeof window === "undefined") return null;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch("/api/guest-trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, deviceId: getGuestDeviceId() }),
      credentials: "same-origin",
      keepalive,
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok) return null;
    return {
      tracked: j.tracked !== false,
      allowed: j.allowed !== false,
      remainingMs: Number.isFinite(j.remainingMs) ? Number(j.remainingMs) : 0,
      reason: j.reason,
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Quanto resta a este aparelho (não grava nada). */
export const guestTrialStatus = () => call("status");
/** Abre (ou retoma) a sessão no servidor. */
export const guestTrialStart = () => call("start");
/** "Ainda cá estou": de poucos em poucos segundos enquanto o convidado usa a app. */
export const guestTrialPing = () => call("ping");
/** Fecha a sessão (sair, mudar de página): o tempo parado deixa de contar. */
export const guestTrialEnd = () => call("end", true);
