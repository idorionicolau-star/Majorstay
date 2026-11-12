export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { calculateExpectedCheckOut, normalizeDate } from '@/lib/hospitality-calc';
import { getGuestRooms, getGuestStays } from '@/lib/guest-mode';

/**
 * POST /api/room-hub/unlock
 * Validação de PIN no servidor para desbloqueio do visor do quarto.
 *
 * Segurança:
 * - O PIN é recebido no corpo do pedido (JSON { c, r, pin }), nunca no URL.
 * - Limite de tentativas no servidor (transação atómica Firestore):
 *   - Contagem de erros em `pinFailedAttempts`.
 *   - Ao 5.º erro consecutivo, bloqueia o acesso por 15 minutos (`pinLockedUntil`), retornando HTTP 429.
 *   - Ao acertar, zera `pinFailedAttempts` e anula `pinLockedUntil`.
 *   - Mensagens de erro genéricas sem vazar se o PIN estava próximo.
 * - Modo convidado ('guest' ou 'guest_*') aceita '1234' fixo.
 * - Empresas reais exigem `accessPin` gerado no check-in (sem fallback para '1234' nem hash de ID).
 * - A resposta com sucesso devolve dados da estadia e Wi-Fi, NUNCA dados pessoais do hóspede.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = typeof body.c === 'string' ? body.c.trim() : '';
    const roomId = typeof body.r === 'string' ? body.r.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    if (!companyId || !roomId) {
      return NextResponse.json({ error: 'Identificador de empresa ou quarto em falta.' }, { status: 400 });
    }

    if (!pin) {
      return NextResponse.json({ error: 'PIN de acesso em falta.' }, { status: 400 });
    }

    // 1. Suporte para Modo Convidado / Demonstração
    if (companyId === 'guest' || companyId.startsWith('guest_')) {
      const guestRooms = getGuestRooms();
      const room = guestRooms.find((r) => r.id === roomId || r.name.toLowerCase() === roomId.toLowerCase()) || guestRooms[0];
      const guestStays = getGuestStays();
      const stay = guestStays.find((s) => s.roomId === room?.id && s.status === 'open') || null;

      if (!stay && room?.status === 'free') {
        return NextResponse.json({ error: 'Quarto livre ou sem estadia ativa.' }, { status: 404 });
      }

      const validPin = stay?.accessPin || '1234';
      if (pin !== validPin) {
        return NextResponse.json({ error: 'PIN incorreto. Acesso não autorizado.' }, { status: 403 });
      }

      const checkInDate = normalizeDate(stay ? stay.checkInAt : new Date(Date.now() - 45 * 60 * 1000));
      const contractedHours = stay?.contractedHours || 2;
      const expCheckOut = stay
        ? calculateExpectedCheckOut(stay.checkInAt, stay.contractedHours, stay.extensions)
        : new Date(Date.now() + 75 * 60 * 1000);

      return NextResponse.json({
        success: true,
        stay: {
          id: stay?.id || 'demo-stay-1',
          checkInAt: checkInDate.toISOString(),
          contractedHours,
          expectedCheckOut: expCheckOut.toISOString(),
          ratePerHour: stay?.ratePerHourApplied || room?.ratePerHour || 300,
          graceMinutes: 10,
        },
        wifi: {
          ssid: 'MajorStay-VIP',
          password: 'staywithcomfort',
        },
      });
    }

    // 2. Empresas reais via Firebase Admin SDK
    const admin = initializeAdmin();
    const db = admin.firestore();

    const roomRef = db.doc(`companies/${companyId}/rooms/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json({ error: 'Quarto não encontrado.' }, { status: 404 });
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
      return NextResponse.json({ error: 'Quarto livre ou sem estadia ativa.' }, { status: 404 });
    }

    const stayRef = db.doc(`companies/${companyId}/stays/${targetStayId}`);
    const companyRef = db.doc(`companies/${companyId}`);

    // Executar validação e rate limit atómicos em transação Firestore
    const unlockResult = await db.runTransaction(async (transaction) => {
      const staySnap = await transaction.get(stayRef);
      if (!staySnap.exists) {
        return { status: 404, error: 'Estadia não encontrada.' };
      }
      const stayData = staySnap.data() || {};
      if (stayData.status !== 'open') {
        return { status: 404, error: 'Esta estadia já se encontra encerrada.' };
      }

      // Estadia aberta sem accessPin fica bloqueada (sem fallbacks '1234' nem hash de ID)
      if (!stayData.accessPin || typeof stayData.accessPin !== 'string') {
        return { status: 403, error: 'PIN indisponível ou acesso bloqueado. Consulte a recepção.' };
      }

      const nowMs = Date.now();
      const lockedUntil = stayData.pinLockedUntil ? normalizeDate(stayData.pinLockedUntil).getTime() : 0;

      // Verificar se o quarto está bloqueado temporariamente (15 minutos)
      if (lockedUntil > nowMs) {
        return {
          status: 429,
          error: 'Demasiadas tentativas incorretas. Acesso bloqueado por 15 minutos.',
        };
      }

      const isCorrectPin = String(stayData.accessPin).trim() === pin;

      if (!isCorrectPin) {
        const currentFailed = Number(stayData.pinFailedAttempts || 0) + 1;
        if (currentFailed >= 5) {
          const lockDate = new Date(nowMs + 15 * 60 * 1000);
          transaction.update(stayRef, {
            pinFailedAttempts: currentFailed,
            pinLockedUntil: lockDate,
          });
          return {
            status: 429,
            error: 'Demasiadas tentativas incorretas. Acesso bloqueado por 15 minutos.',
          };
        } else {
          transaction.update(stayRef, {
            pinFailedAttempts: currentFailed,
          });
          return {
            status: 403,
            error: 'PIN incorreto. Acesso não autorizado.',
          };
        }
      }

      // PIN correto: zerar contadores de falhas e desbloquear
      transaction.update(stayRef, {
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      });

      const companySnap = await transaction.get(companyRef);
      const companyData = companySnap.exists ? (companySnap.data() || {}) : {};

      const checkInDate = normalizeDate(stayData.checkInAt);
      const contractedHours = stayData.contractedHours || 1;
      const expCheckOut = calculateExpectedCheckOut(stayData.checkInAt, stayData.contractedHours, stayData.extensions);

      return {
        status: 200,
        stay: {
          id: staySnap.id,
          checkInAt: checkInDate.toISOString(),
          contractedHours,
          expectedCheckOut: expCheckOut.toISOString(),
          ratePerHour: stayData.ratePerHourApplied || roomData.ratePerHour || 0,
          graceMinutes: 10,
        },
        wifi: {
          ssid: companyData.wifiSsid ? String(companyData.wifiSsid).trim() : null,
          password: companyData.wifiPassword ? String(companyData.wifiPassword).trim() : null,
        },
      };
    });

    if (unlockResult.status !== 200) {
      return NextResponse.json({ error: unlockResult.error }, { status: unlockResult.status });
    }

    return NextResponse.json({
      success: true,
      stay: unlockResult.stay,
      wifi: unlockResult.wifi,
    });
  } catch (err: any) {
    console.error('Erro em /api/room-hub/unlock:', err);
    return NextResponse.json({ error: 'Erro interno ao validar PIN do quarto.' }, { status: 500 });
  }
}
