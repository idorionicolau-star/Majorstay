import { normalizeDate } from '@/lib/hospitality-calc';

/**
 * Validação do PIN da estadia, no servidor, partilhada pelas rotas públicas do QR do quarto
 * (/api/room-hub/unlock e /api/room-hub/order).
 *
 * - Procura a estadia aberta do quarto.
 * - Compara o PIN dentro de uma transacção e conta as falhas na própria estadia (pinFailedAttempts).
 * - Ao 5.º erro bloqueia (1, 5 e depois 15 minutos, pinLockedUntil → 429). Ao acertar, zera os contadores.
 * - Mensagens genéricas: nunca dizem se o PIN estava perto.
 * - Estadia aberta sem accessPin fica bloqueada (sem PIN por defeito).
 */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;
/** Bloqueio progressivo: 1.º bloqueio 1 min, 2.º 5 min, a partir do 3.º 15 min. */
export const PIN_LOCK_STEPS_MS = [60 * 1000, 5 * 60 * 1000, PIN_LOCK_MS];
const lockMessage = (ms: number) => `Demasiadas tentativas incorretas. Acesso bloqueado por ${Math.max(1, Math.round(ms / 60000))} min. A receção pode desbloquear.`;

export type RoomPinResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      stayId: string;
      stayData: Record<string, any>;
      roomData: Record<string, any>;
      companyData: Record<string, any>;
    };

export async function verifyRoomPin(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  roomId: string,
  pin: string
): Promise<RoomPinResult> {
  const roomRef = db.doc(`companies/${companyId}/rooms/${roomId}`);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    return { ok: false, status: 404, error: 'Quarto não encontrado.' };
  }
  const roomData = roomSnap.data() || {};

  let targetStayId: string | null = null;
  if (roomData.currentStayId) {
    const sDoc = await db.doc(`companies/${companyId}/stays/${roomData.currentStayId}`).get();
    if (sDoc.exists && sDoc.data()?.status === 'open') {
      targetStayId = roomData.currentStayId;
    }
  }

  if (!targetStayId) {
    const openStaysSnap = await db
      .collection(`companies/${companyId}/stays`)
      .where('roomId', '==', roomId)
      .where('status', '==', 'open')
      .limit(1)
      .get();
    if (!openStaysSnap.empty) {
      targetStayId = openStaysSnap.docs[0].id;
    }
  }

  if (!targetStayId) {
    return { ok: false, status: 404, error: 'Quarto livre ou sem estadia ativa.' };
  }

  const stayRef = db.doc(`companies/${companyId}/stays/${targetStayId}`);
  const companyRef = db.doc(`companies/${companyId}`);

  return db.runTransaction(async (transaction): Promise<RoomPinResult> => {
    // O Firestore exige que TODAS as leituras de uma transacção venham antes de qualquer escrita.
    const staySnap = await transaction.get(stayRef);
    const companySnap = await transaction.get(companyRef);
    if (!staySnap.exists) {
      return { ok: false, status: 404, error: 'Estadia não encontrada.' };
    }
    const stayData = staySnap.data() || {};
    if (stayData.status !== 'open') {
      return { ok: false, status: 404, error: 'Esta estadia já se encontra encerrada.' };
    }

    if (!stayData.accessPin || typeof stayData.accessPin !== 'string') {
      return { ok: false, status: 403, error: 'PIN indisponível ou acesso bloqueado. Consulte a recepção.' };
    }

    const nowMs = Date.now();
    const lockedUntil = stayData.pinLockedUntil ? normalizeDate(stayData.pinLockedUntil).getTime() : 0;
    if (lockedUntil > nowMs) {
      return { ok: false, status: 429, error: lockMessage(lockedUntil - nowMs) };
    }

    if (String(stayData.accessPin).trim() !== pin) {
      const failed = Number(stayData.pinFailedAttempts || 0) + 1;
      if (failed >= PIN_MAX_ATTEMPTS) {
        const count = Number(stayData.pinLockCount || 0);
        const lockMs = PIN_LOCK_STEPS_MS[Math.min(count, PIN_LOCK_STEPS_MS.length - 1)];
        transaction.update(stayRef, { pinFailedAttempts: 0, pinLockCount: count + 1, pinLockedUntil: new Date(nowMs + lockMs) });
        return { ok: false, status: 429, error: lockMessage(lockMs) };
      }
      transaction.update(stayRef, { pinFailedAttempts: failed });
      return { ok: false, status: 403, error: 'PIN incorreto. Acesso não autorizado.' };
    }

    transaction.update(stayRef, { pinFailedAttempts: 0, pinLockCount: 0, pinLockedUntil: null });

    return {
      ok: true,
      stayId: staySnap.id,
      stayData,
      roomData,
      companyData: companySnap.exists ? companySnap.data() || {} : {},
    };
  });
}
