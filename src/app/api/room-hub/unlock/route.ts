export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { calculateExpectedCheckOut, calculateStayPricing, normalizeDate, totalContractedHours } from '@/lib/hospitality-calc';
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
      const ratePerHour = stay?.ratePerHourApplied || room?.ratePerHour || 300;

      const rawConsumptions = Array.isArray(stay?.consumptions) ? stay.consumptions : [];
      const consumptions = rawConsumptions.map((c: any, idx: number) => ({
        id: c.id || `demo-c-${idx}`,
        productName: String(c.productName || 'Item de Bar'),
        quantity: Number(c.quantity || 1),
        unitPrice: Number(c.unitPrice || 0),
        totalPrice: Number(c.totalPrice || (c.quantity * c.unitPrice) || 0),
        addedAt: c.addedAt ? normalizeDate(c.addedAt).toISOString() : null,
      }));
      const consumptionsTotal = consumptions.reduce((acc: number, c: any) => acc + c.totalPrice, 0);
      const roomTotal = contractedHours * ratePerHour;

      return NextResponse.json({
        success: true,
        stay: {
          id: stay?.id || 'demo-stay-1',
          checkInAt: checkInDate.toISOString(),
          contractedHours,
          expectedCheckOut: expCheckOut.toISOString(),
          ratePerHour,
          graceMinutes: 10,
          consumptions,
        },
        orders: [],
        pricing: {
          roomTotal,
          consumptionsTotal,
          pendingOrdersTotal: 0,
          totalDue: roomTotal + consumptionsTotal,
          estimatedTotalWithPending: roomTotal + consumptionsTotal,
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
    const ratePerHour = stayData.ratePerHourApplied || roomData.ratePerHour || 0;

    // Consumos confirmados na conta da estadia
    const rawConsumptions = Array.isArray(stayData.consumptions) ? stayData.consumptions : [];
    const consumptions = rawConsumptions.map((c: any, idx: number) => ({
      id: c.id || `c-${idx}`,
      productName: String(c.productName || 'Item de Bar'),
      quantity: Number(c.quantity || 1),
      unitPrice: Number(c.unitPrice || 0),
      totalPrice: Number(c.totalPrice || (c.quantity * c.unitPrice) || 0),
      addedAt: c.addedAt ? normalizeDate(c.addedAt).toISOString() : null,
    }));
    const consumptionsTotal = consumptions.reduce((acc: number, c: any) => acc + c.totalPrice, 0);

    // Pedidos de bar do quarto (pendentes, confirmados ou recusados)
    let orders: any[] = [];
    try {
      const ordersSnap = await db
        .collection(`companies/${companyId}/roomOrders`)
        .where('stayId', '==', stayId)
        .limit(50)
        .get();

      if (!ordersSnap.empty) {
        orders = ordersSnap.docs.map((doc) => {
          const d = doc.data() || {};
          return {
            id: doc.id,
            status: d.status || 'pending',
            items: Array.isArray(d.items) ? d.items.map((it: any) => ({
              productId: it.productId,
              productName: it.productName,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
            })) : [],
            total: Number(d.total || 0),
            createdAt: d.createdAt ? normalizeDate(d.createdAt).toISOString() : new Date().toISOString(),
            rejectReason: d.rejectReason || null,
          };
        });
      }
    } catch (ordersErr) {
      console.warn('Não foi possível ler roomOrders para o visor do quarto:', ordersErr);
    }

    // Extensões de horas
    const extensionsHours = Array.isArray(stayData.extensions)
      ? stayData.extensions.reduce((acc: number, ext: any) => acc + (Number(ext.hours) || 0), 0)
      : 0;
    const totalHours = contractedHours + extensionsHours;
    // Mesma regra do check-out (horas começadas e tolerância), para o valor mostrado bater com o cobrado.
    let roomTotal = totalHours * ratePerHour;
    try {
      roomTotal = calculateStayPricing({
        checkInAt: stayData.checkInAt,
        checkOutAt: new Date(),
        contractedHours: totalContractedHours(stayData),
        ratePerHour,
        consumptions: [],
      }).stayAmountDue;
    } catch { /* mantém o valor contratado */ }

    const pendingOrdersTotal = orders
      .filter((o) => o.status === 'pending')
      .reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);

    const totalDue = roomTotal + consumptionsTotal;
    const estimatedTotalWithPending = totalDue + pendingOrdersTotal;

    return NextResponse.json({
      success: true,
      stay: {
        id: stayId,
        checkInAt: checkInDate.toISOString(),
        contractedHours,
        expectedCheckOut: expCheckOut.toISOString(),
        ratePerHour,
        graceMinutes: 10,
        consumptions,
      },
      orders,
      pricing: {
        roomTotal,
        consumptionsTotal,
        pendingOrdersTotal,
        totalDue,
        estimatedTotalWithPending,
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
