export const dynamic = 'force-dynamic';

import { KITCHEN_ENABLED, isKitchenProduct } from '@/lib/features';
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { verifyRoomPin } from '@/lib/room-pin';

/**
 * POST /api/room-hub/order — pedido de bar feito pelo hóspede no QR do quarto.
 * Fica registado como PENDENTE; só passa para a conta da estadia quando a receção o confirma.
 *
 * Segurança (rota pública):
 * - exige o PIN da estadia (mesma validação e limite de tentativas do /unlock);
 * - os preços e nomes vêm SEMPRE do catálogo, nunca do que o navegador envia;
 * - quantidades inteiras 1–20, no máximo 15 linhas e 5 pedidos pendentes por estadia.
 */
const MAX_LINES = 15;
const MAX_QTY = 20;
const MAX_WEIGHT_KG = 20;
const MAX_PENDING_PER_STAY = 5;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = typeof body.c === 'string' ? body.c.trim() : '';
    const roomId = typeof body.r === 'string' ? body.r.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    const orderNotes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) : '';
    const rawItems: unknown = body.items;

    if (!companyId || !roomId) {
      return NextResponse.json({ error: 'Identificador de empresa ou quarto em falta.' }, { status: 400 });
    }
    if (!pin) {
      return NextResponse.json({ error: 'PIN de acesso em falta.' }, { status: 400 });
    }
    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > MAX_LINES) {
      return NextResponse.json({ error: 'Pedido vazio ou com itens a mais.' }, { status: 400 });
    }

    // Juntar linhas repetidas do mesmo produto e recolher notas
    const wanted = new Map<string, number>();
    const itemNotes = new Map<string, string>();
    const itemWeights = new Map<string, number>();
    for (const raw of rawItems) {
      const productId = typeof (raw as any)?.productId === 'string' ? (raw as any).productId.trim() : '';
      const quantity = (raw as any)?.quantity;
      const n = typeof (raw as any)?.notes === 'string' ? (raw as any).notes.trim().slice(0, 150) : '';
      if (!productId || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
        return NextResponse.json({ error: `Item inválido. A quantidade deve ser um número inteiro entre 1 e ${MAX_QTY}.` }, { status: 400 });
      }
      const w = (raw as any)?.weightKg;
      if (w !== undefined) {
        if (typeof w !== 'number' || !Number.isFinite(w) || w < 0.1 || w > MAX_WEIGHT_KG) {
          return NextResponse.json({ error: `Peso inválido. Indique entre 0,1 e ${MAX_WEIGHT_KG} kg.` }, { status: 400 });
        }
        itemWeights.set(productId, Math.round(((itemWeights.get(productId) || 0) + w) * 1000) / 1000);
      }
      wanted.set(productId, (wanted.get(productId) || 0) + quantity);
      if (n) itemNotes.set(productId, n);
    }
    for (const qty of wanted.values()) {
      if (qty > MAX_QTY) {
        return NextResponse.json({ error: `Quantidade máxima por produto: ${MAX_QTY}.` }, { status: 400 });
      }
    }

    // Modo convidado / demonstração: aceita, mas não grava nada.
    if (companyId === 'guest' || companyId.startsWith('guest_')) {
      if (pin !== '1234') {
        return NextResponse.json({ error: 'PIN incorreto. Acesso não autorizado.' }, { status: 403 });
      }
      return NextResponse.json({ success: true, demo: true, orderId: 'demo-order', status: 'pending' });
    }

    const admin = initializeAdmin();
    const db = admin.firestore();

    const pinResult = await verifyRoomPin(db, companyId, roomId, pin);
    if (!pinResult.ok) {
      return NextResponse.json({ error: pinResult.error }, { status: pinResult.status });
    }
    const { stayId, roomData } = pinResult;

    // Produtos do catálogo (preço e nome da base de dados)
    const lines: { productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number; weightKg?: number; notes?: string }[] = [];
    for (const [productId, quantity] of wanted) {
      const snap = await db.doc(`companies/${companyId}/products/${productId}`).get();
      const data = snap.exists ? snap.data() || {} : null;
      if (!data || data.deletedAt || (!KITCHEN_ENABLED && isKitchenProduct(data))) {
        return NextResponse.json({ error: 'Um dos produtos já não está disponível. Atualize a página.' }, { status: 400 });
      }
      const price = Number(data.price !== undefined ? data.price : data.salePrice);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: 'Um dos produtos não tem preço definido.' }, { status: 400 });
      }
      // Prato vendido ao peso: o preço é por kg e o peso é obrigatório (quantidade fica 1)
      const weighed = Boolean(data.soldByWeight);
      const weightKg = itemWeights.get(productId);
      if (weighed && !weightKg) {
        return NextResponse.json({ error: `Indique o peso (kg) de "${String(data.name || 'prato')}".` }, { status: 400 });
      }
      lines.push({
        productId,
        productName: String(data.name || 'Produto').trim(),
        quantity: weighed ? 1 : quantity,
        unitPrice: price,
        totalPrice: weighed && weightKg ? Math.round(price * weightKg * 100) / 100 : price * quantity,
        ...(weighed && weightKg ? { weightKg } : {}),
        ...(itemNotes.has(productId) ? { notes: itemNotes.get(productId) } : {}),
      });
    }

    const pending = await db
      .collection(`companies/${companyId}/roomOrders`)
      .where('stayId', '==', stayId)
      .where('status', '==', 'pending')
      .limit(MAX_PENDING_PER_STAY)
      .get();
    if (pending.docs.length >= MAX_PENDING_PER_STAY) {
      return NextResponse.json({ error: 'Já tem pedidos a aguardar a receção. Aguarde a confirmação.' }, { status: 429 });
    }

    const ref = db.collection(`companies/${companyId}/roomOrders`).doc();
    const total = lines.reduce((s, l) => s + l.totalPrice, 0);
    await ref.set({
      stayId,
      roomId,
      roomName: String(roomData.name || 'Quarto'),
      items: lines,
      ...(orderNotes ? { notes: orderNotes } : {}),
      total,
      status: 'pending',
      source: 'guest',
      createdAt: new Date().toISOString(),
      companyId,
    });

    return NextResponse.json({ success: true, orderId: ref.id, status: 'pending', total });
  } catch (err) {
    console.error('Erro em /api/room-hub/order:', err);
    return NextResponse.json({ error: 'Erro interno ao registar o pedido.' }, { status: 500 });
  }
}
