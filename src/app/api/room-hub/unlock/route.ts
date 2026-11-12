export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { calculateExpectedCheckOut, normalizeDate } from '@/lib/hospitality-calc';
import { getGuestRooms, getGuestStays } from '@/lib/guest-mode';
import { verifyRoomPin } from '@/lib/room-pin';

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
    const db = initializeAdmin().firestore();
    const result = await verifyRoomPin(db, companyId, roomId, pin);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { stayId, stayData, roomData, companyData } = result;
    const checkInDate = normalizeDate(stayData.checkInAt);
    const contractedHours = stayData.contractedHours || 1;
    const expCheckOut = calculateExpectedCheckOut(stayData.checkInAt, stayData.contractedHours, stayData.extensions);

    return NextResponse.json({
      success: true,
      stay: {
        id: stayId,
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
    });
  } catch (err: any) {
    console.error('Erro em /api/room-hub/unlock:', err);
    return NextResponse.json({ error: 'Erro interno ao validar PIN do quarto.' }, { status: 500 });
  }
}
