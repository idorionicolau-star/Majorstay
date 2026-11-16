export const dynamic = 'force-dynamic';

import { loadRoomMenu } from '@/lib/room-menu';
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { getGuestRooms, getGuestStays } from '@/lib/guest-mode';

/**
 * GET /api/room-hub
 * Endpoint público para o Visor / QR Code do Quarto.
 * 
 * Regra de Segurança Estrita:
 * - Sem PIN, apenas devolve:
 *   1. Quarto (id, nome, tipo, estado)
 *   2. Hotel (nome, telefone, whatsapp)
 *   3. pinRequired: true (se houver estadia aberta) ou false (se quarto livre/fechado)
 *   4. barProducts: só se o quarto estiver livre; com estadia aberta vem vazio (o menu sai no /unlock, com PIN)
 * - NUNCA devolve:
 *   - Dados da estadia (horas contratadas, checkIn, checkOut, valores)
 *   - Senha / SSID de Wi-Fi
 *   - accessPin
 *   - Dados pessoais do hóspede (nome, telefone, documento)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('c') || '';
    const roomId = searchParams.get('r') || '';

    if (!companyId || !roomId) {
      return NextResponse.json({ error: 'Identificador de empresa ou quarto em falta.' }, { status: 400 });
    }

    // Suporte para Modo Convidado / Demonstração
    if (companyId === 'guest' || companyId.startsWith('guest_')) {
      const guestRooms = getGuestRooms();
      const room = guestRooms.find((r) => r.id === roomId || r.name.toLowerCase() === roomId.toLowerCase()) || guestRooms[0];
      const guestStays = getGuestStays();
      const stay = guestStays.find((s) => s.roomId === room?.id && s.status === 'open') || null;

      const hasOpenStay = Boolean(stay && (room?.status === 'occupied' || room?.status === 'overtime' || stay.status === 'open'));

      return NextResponse.json({
        room: {
          id: room ? room.id : roomId,
          name: room ? room.name : 'Quarto Demo',
          type: room?.type || 'Standard',
          status: hasOpenStay ? (room?.status || 'occupied') : 'free',
          ratePerHour: room ? room.ratePerHour : 300,
        },
        hotel: {
          name: 'MajorStay Grand Hotel & Suites',
          phone: '+258 84 123 4567',
          whatsapp: '258841234567',
        },
        pinRequired: hasOpenStay,
        barProducts: [
          { id: '1', name: 'Cerveja 2M 330ml', price: 120, category: 'Bebidas' },
          { id: '2', name: 'Cerveja Laurentina Clara 330ml', price: 120, category: 'Bebidas' },
          { id: '3', name: 'Cerveja Heineken Long Neck', price: 150, category: 'Bebidas' },
          { id: '4', name: 'Água Mineral 500ml', price: 50, category: 'Bebidas' },
          { id: '5', name: 'Refrigerante Coca-Cola Lata', price: 70, category: 'Bebidas' },
          { id: '10', name: 'Batatas Fritas Crocantes', price: 150, category: 'Snacks' },
        ],
      });
    }

    const admin = initializeAdmin();
    const db = admin.firestore();

    // 1. Obter quarto
    const roomDoc = await db.doc(`companies/${companyId}/rooms/${roomId}`).get();
    if (!roomDoc.exists) {
      return NextResponse.json({ error: 'Quarto não encontrado.' }, { status: 404 });
    }
    const roomData = roomDoc.data() || {};

    // 2. Obter dados do hotel / estabelecimento (apenas dados públicos: nome, telefone, whatsapp)
    const companyDoc = await db.doc(`companies/${companyId}`).get();
    const companyData = companyDoc.exists ? (companyDoc.data() || {}) : {};

    const rawPhone = companyData.phone || '';
    const cleanWhatsapp = rawPhone.replace(/\D/g, '');

    // 3. Verificar se existe estadia aberta (sem expor detalhes)
    let hasOpenStay = false;
    if (roomData.status === 'occupied' || roomData.status === 'overtime' || roomData.currentStayId) {
      if (roomData.currentStayId) {
        const stayDoc = await db.doc(`companies/${companyId}/stays/${roomData.currentStayId}`).get();
        if (stayDoc.exists && stayDoc.data()?.status === 'open') {
          hasOpenStay = true;
        }
      }

      if (!hasOpenStay) {
        const openStaysSnap = await db
          .collection(`companies/${companyId}/stays`)
          .where('roomId', '==', roomId)
          .where('status', '==', 'open')
          .limit(1)
          .get();

        if (!openStaysSnap.empty) {
          hasOpenStay = true;
        }
      }
    }

    // 4. Menu: com estadia aberta só se entrega depois de acertar o PIN (/unlock); quarto livre mostra o menu
    const barProducts = hasOpenStay ? [] : await loadRoomMenu(db, companyId);

    // Resposta estrita: sem stay, sem wifi, sem accessPin, sem dados de hóspede
    return NextResponse.json({
      room: {
        id: roomDoc.id,
        name: roomData.name || 'Quarto',
        type: roomData.type || 'Standard',
        status: hasOpenStay ? (roomData.status || 'occupied') : 'free',
        ratePerHour: roomData.ratePerHour || 0,
      },
      hotel: {
        name: companyData.name || 'MajorStay',
        phone: rawPhone,
        whatsapp: cleanWhatsapp || '258840000000',
      },
      pinRequired: hasOpenStay,
      barProducts,
    });
  } catch (err: any) {
    console.error('Erro em /api/room-hub:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar dados do quarto.' }, { status: 500 });
  }
}
