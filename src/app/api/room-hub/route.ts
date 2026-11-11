export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { calculateExpectedCheckOut, normalizeDate } from '@/lib/hospitality-calc';
import { getGuestRooms, getGuestStays } from '@/lib/guest-mode';

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

      return NextResponse.json({
        room: {
          id: room ? room.id : roomId,
          name: room ? room.name : 'Quarto Demo',
          type: room?.type || 'Standard',
          status: room ? room.status : 'occupied',
          ratePerHour: room ? room.ratePerHour : 300,
        },
        hotel: {
          name: 'MajorStay Grand Hotel & Suites',
          phone: '+258 84 123 4567',
          whatsapp: '258841234567',
          wifiSsid: 'MajorStay-VIP',
          wifiPassword: 'staywithcomfort',
        },
        stay: stay ? {
          id: stay.id,
          checkInAt: normalizeDate(stay.checkInAt).toISOString(),
          contractedHours: stay.contractedHours || 2,
          expectedCheckOut: calculateExpectedCheckOut(stay.checkInAt, stay.contractedHours, stay.extensions).toISOString(),
          ratePerHour: stay.ratePerHourApplied || 300,
          graceMinutes: 10,
        } : {
          id: 'demo-stay-1',
          checkInAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          contractedHours: 2,
          expectedCheckOut: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
          ratePerHour: 300,
          graceMinutes: 10,
        },
        barProducts: [
          { id: '1', name: 'Cerveja 2M 330ml', price: 120, category: 'Bebidas' },
          { id: '2', name: 'Cerveja Laurentina Clara 330ml', price: 120, category: 'Bebidas' },
          { id: '3', name: 'Cerveja Heineken Long Neck', price: 150, category: 'Bebidas' },
          { id: '4', name: 'Água Mineral 500ml', price: 50, category: 'Bebidas' },
          { id: '5', name: 'Refrigerante Coca-Cola Lata', price: 70, category: 'Bebidas' },
          { id: '6', name: 'Red Bull Energy Drink 250ml', price: 180, category: 'Energéticos' },
          { id: '7', name: 'Porção de Amendoim Torrado', price: 100, category: 'Snacks' },
          { id: '8', name: 'Batatas Fritas Crocantes', price: 120, category: 'Snacks' },
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

    // 2. Obter dados do hotel / estabelecimento
    const companyDoc = await db.doc(`companies/${companyId}`).get();
    const companyData = companyDoc.exists ? (companyDoc.data() || {}) : {};

    const rawPhone = companyData.phone || '';
    const cleanWhatsapp = rawPhone.replace(/\D/g, '');

    // 3. Obter estadia ativa se ocupado
    let activeStay: any = null;
    if (roomData.status === 'occupied' || roomData.status === 'overtime' || roomData.currentStayId) {
      if (roomData.currentStayId) {
        const stayDoc = await db.doc(`companies/${companyId}/stays/${roomData.currentStayId}`).get();
        if (stayDoc.exists && stayDoc.data()?.status === 'open') {
          const s = stayDoc.data()!;
          const checkInDate = normalizeDate(s.checkInAt);
          const expCheckOut = calculateExpectedCheckOut(s.checkInAt, s.contractedHours, s.extensions);
          activeStay = {
            id: stayDoc.id,
            checkInAt: checkInDate.toISOString(),
            contractedHours: s.contractedHours || 1,
            expectedCheckOut: expCheckOut.toISOString(),
            ratePerHour: s.ratePerHourApplied || roomData.ratePerHour || 0,
            graceMinutes: 10,
          };
        }
      }

      if (!activeStay) {
        const openStaysSnap = await db
          .collection(`companies/${companyId}/stays`)
          .where('roomId', '==', roomId)
          .where('status', '==', 'open')
          .limit(1)
          .get();

        if (!openStaysSnap.empty) {
          const s = openStaysSnap.docs[0].data();
          const checkInDate = normalizeDate(s.checkInAt);
          const expCheckOut = calculateExpectedCheckOut(s.checkInAt, s.contractedHours, s.extensions);
          activeStay = {
            id: openStaysSnap.docs[0].id,
            checkInAt: checkInDate.toISOString(),
            contractedHours: s.contractedHours || 1,
            expectedCheckOut: expCheckOut.toISOString(),
            ratePerHour: s.ratePerHourApplied || roomData.ratePerHour || 0,
            graceMinutes: 10,
          };
        }
      }
    }

    // 4. Produtos do bar (sem filtro 'active', excluindo deletedAt e preço <= 0, deduplicados por nome)
    const barProducts: { id: string; name: string; price: number; category?: string }[] = [];
    try {
      const prodSnap = await db
        .collection(`companies/${companyId}/products`)
        .limit(100)
        .get();

      const seenNames = new Set<string>();
      for (const docSnap of prodSnap.docs) {
        const p = docSnap.data() || {};
        if (p.deletedAt) continue;
        const price = Number(p.price !== undefined ? p.price : (p.salePrice !== undefined ? p.salePrice : 0));
        if (!Number.isFinite(price) || price <= 0) continue;

        const name = (p.name || 'Produto').trim();
        const normalizedName = name.toLowerCase();
        if (seenNames.has(normalizedName)) continue;
        seenNames.add(normalizedName);

        barProducts.push({
          id: docSnap.id,
          name,
          price,
          category: p.category || 'Bar',
        });

        if (barProducts.length >= 30) break;
      }
    } catch (e) {
      console.warn('Erro ao carregar produtos do bar:', e);
    }

    return NextResponse.json({
      room: {
        id: roomDoc.id,
        name: roomData.name || 'Quarto',
        type: roomData.type || 'Standard',
        status: roomData.status || 'free',
        ratePerHour: roomData.ratePerHour || 0,
        notes: roomData.notes || '',
      },
      hotel: {
        name: companyData.name || 'MajorStay',
        phone: rawPhone,
        whatsapp: cleanWhatsapp || '258840000000',
        wifiSsid: companyData.wifiSsid ? String(companyData.wifiSsid).trim() : null,
        wifiPassword: companyData.wifiPassword ? String(companyData.wifiPassword).trim() : null,
      },
      stay: activeStay,
      barProducts,
    });
  } catch (err: any) {
    console.error('Erro em /api/room-hub:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar dados do quarto.' }, { status: 500 });
  }
}
