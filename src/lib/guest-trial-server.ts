// Parte do servidor do relógio do convidado, sem Firebase nem Next (recebe a base de dados por parâmetro): a rota
// /api/guest-trial usa-a com o Firestore a sério e os testes com uma base de dados falsa em memória.
import {
  GUEST_TRIAL_MAX_DEVICES_PER_IP,
  applyGuestTrial,
  parseGuestTrial,
  registerDevice,
  type GuestTrialAction,
} from "@/lib/guest-trial";

export type TrialSnap = { exists: boolean; data(): unknown };
export type TrialTx = {
  get(ref: unknown): Promise<TrialSnap>;
  set(ref: unknown, data: Record<string, unknown>, options?: { merge: boolean }): void;
};
export type TrialDb = {
  /** Referência a um documento da coleção `guestTrials`. */
  ref(id: string): unknown;
  runTransaction<T>(fn: (tx: TrialTx) => Promise<T>): Promise<T>;
};

export type TrackResult = {
  allowed: boolean;
  remainingMs: number;
  /** Porque não pode: `time` = o aparelho gastou os 30 minutos; `network` = esta rede já abriu aparelhos a mais. */
  reason?: "time" | "network";
};

/**
 * Regista um passo do convidado. `deviceId` e `ipHash` já vêm em hash (nunca se guarda o IP nem o código em claro).
 * `status` só lê: ver o ecrã de login não cria nada.
 */
export async function trackGuestTrial(
  db: TrialDb,
  p: { deviceId: string; ipHash: string | null; action: GuestTrialAction; now: number; maxDevices?: number },
): Promise<TrackResult> {
  const max = p.maxDevices ?? GUEST_TRIAL_MAX_DEVICES_PER_IP;
  return db.runTransaction(async (tx) => {
    const deviceRef = db.ref(`dev_${p.deviceId}`);
    const ipRef = p.ipHash ? db.ref(`ip_${p.ipHash}`) : null;

    // todas as leituras antes de qualquer escrita (regra das transações)
    const deviceSnap = await tx.get(deviceRef);
    const ipSnap = ipRef ? await tx.get(ipRef) : null;

    const ipData = (ipSnap?.data() ?? {}) as { devices?: unknown };
    const registration = ipRef ? registerDevice(ipData.devices, p.deviceId, max) : null;

    // aparelho novo numa rede que já está cheia: não entra
    if (registration && !registration.allowed && !deviceSnap.exists) {
      return { allowed: false, remainingMs: 0, reason: "network" as const };
    }

    const out = applyGuestTrial(parseGuestTrial(deviceSnap.data()), p.action, p.now);

    if (p.action !== "status") {
      tx.set(
        deviceRef,
        {
          usedMs: out.state.usedMs,
          sessionStart: out.state.sessionStart,
          lastBeat: out.state.lastBeat,
          updatedAt: p.now,
          ...(deviceSnap.exists ? {} : { createdAt: p.now }),
        },
        { merge: true },
      );
      if (ipRef && registration?.changed) {
        tx.set(ipRef, { devices: registration.devices, updatedAt: p.now }, { merge: true });
      }
    }

    return out.allowed
      ? { allowed: true, remainingMs: out.remainingMs }
      : { allowed: false, remainingMs: 0, reason: "time" as const };
  });
}
