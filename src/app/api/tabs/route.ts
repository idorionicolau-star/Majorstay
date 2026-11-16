export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { nextGuideNumber } from '@/lib/sale-plan';
import { cleanClientName, tabTotal, type TabItem } from '@/lib/tabs';
import { isKitchenProduct, KITCHEN_ENABLED } from '@/lib/features';

/**
 * Contas abertas do Lounge & Bar (companies/{c}/tabs).
 * POST { companyId, action }:
 *   list                                  → contas abertas
 *   open   { clientName }                 → abre conta
 *   add    { tabId, productId, quantity } → lança (preço do servidor; o stock desce já)
 *   dec    { tabId, itemId }              → menos 1 (o stock volta)
 *   remove { tabId, itemId, reason }      → tira um item (o stock volta)
 *   close  { tabId, paymentMethod }       → cobra: cria as vendas no caixa
 *   toRoom { tabId, stayId }              → passa os itens para a conta de um quarto
 *   cancel { tabId }                      → apaga uma conta sem itens
 * Precisa de Vendas (escrita) ou Admin; ver a lista também aceita Vendas (leitura) ou Dono.
 */
const PAYMENTS = ['Numerário', 'M-Pesa', 'e-Mola', 'POS / Cartão', 'Transferência', 'Dinheiro', 'Cartão', 'Ponto24'];
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, action } = body;
    const decoded = (await verifyIdToken(req)) as { uid: string; name?: string; email?: string; superAdmin?: boolean; companyId?: string } | null;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    if (!companyId || typeof companyId !== 'string') return NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 });
    if (!decoded.superAdmin && companyId !== decoded.companyId) return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });

    const admin = initializeAdmin();
    const db = admin.firestore();
    let name = decoded.name || decoded.email || 'Funcionário';
    let canView = decoded.superAdmin === true;
    let canWrite = canView;
    if (!canView) {
      const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
      const d = emp.exists ? emp.data() || {} : {};
      name = (d.username as string) || name;
      const perm = d.permissions?.sales;
      canWrite = d.role === 'Admin' || perm === 'write';
      canView = canWrite || d.role === 'Dono' || perm === 'read';
    }
    if (!canView) return NextResponse.json({ error: 'Sem permissão para as contas abertas.' }, { status: 403 });

    const col = db.collection(`companies/${companyId}/tabs`);
    const now = () => new Date().toISOString();

    if (action === 'list') {
      const snap = await col.where('status', '==', 'open').limit(100).get();
      const tabs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => String(a.openedAt).localeCompare(String(b.openedAt)));
      return NextResponse.json({ tabs });
    }

    if (!canWrite) return NextResponse.json({ error: 'Sem permissão para alterar contas abertas.' }, { status: 403 });

    if (action === 'open') {
      const clientName = cleanClientName(body.clientName);
      if (clientName.length < 2) return NextResponse.json({ error: 'Indique o nome do cliente.' }, { status: 400 });
      const open = await col.where('status', '==', 'open').limit(100).get();
      if (open.docs.length >= 100) return NextResponse.json({ error: 'Há contas abertas a mais. Feche algumas.' }, { status: 400 });
      const ref = col.doc();
      const phone = String(body.phone ?? '').replace(/[^0-9+ ]/g, '').trim().slice(0, 20);
      await ref.set({ clientName, ...(phone ? { phone } : {}), status: 'open', items: [], openedAt: now(), openedByUid: decoded.uid, openedByName: name, companyId });
      return NextResponse.json({ success: true, id: ref.id });
    }

    const tabId = String(body.tabId || '');
    if (!tabId) return NextResponse.json({ error: 'Conta em falta.' }, { status: 400 });
    const tabRef = col.doc(tabId);

    if (action === 'cancel') {
      const snap = await tabRef.get();
      if (!snap.exists) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
      const t = snap.data() || {};
      if (t.status !== 'open' || (t.items || []).length > 0) return NextResponse.json({ error: 'Só se apaga uma conta aberta e vazia.' }, { status: 400 });
      await tabRef.delete();
      return NextResponse.json({ success: true });
    }

    if (action === 'add') {
      const quantity = body.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return NextResponse.json({ error: 'Quantidade inválida (1 a 100).' }, { status: 400 });
      const productId = String(body.productId || '');
      if (!productId) return NextResponse.json({ error: 'Produto em falta.' }, { status: 400 });
      const prodRef = db.doc(`companies/${companyId}/products/${productId}`);
      let resultItems: TabItem[] = [];
      await db.runTransaction(async (tx) => {
        const tabSnap = await tx.get(tabRef);
        const prodSnap = await tx.get(prodRef);
        if (!tabSnap.exists || tabSnap.data()?.status !== 'open') throw new Error('Esta conta já não está aberta.');
        if (!prodSnap.exists) throw new Error('Produto não encontrado.');
        const p = prodSnap.data() || {};
        if (p.deletedAt || (!KITCHEN_ENABLED && isKitchenProduct(p))) throw new Error('Este produto não está disponível.');
        const price = Number(p.price !== undefined ? p.price : p.salePrice);
        if (!Number.isFinite(price) || price <= 0) throw new Error(`"${p.name || 'Produto'}" não tem preço definido.`);
        const stock = Number(p.stock) || 0;
        if (stock < quantity) throw new Error(`Stock insuficiente de "${p.name}": só há ${stock}.`);
        const items: TabItem[] = Array.isArray(tabSnap.data()?.items) ? tabSnap.data()!.items : [];
        const item: TabItem = {
          id: `ti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId,
          productName: String(p.name || 'Produto'),
          quantity,
          unitPrice: price,
          totalPrice: round2(price * quantity),
          ...(p.unit ? { unit: String(p.unit) } : {}),
          ...(p.location ? { location: String(p.location) } : {}),
          ...(Number.isFinite(Number(p.cost)) ? { unitCost: Number(p.cost) } : {}),
          addedAt: now(),
          addedByName: name,
        };
        const same = items.find((i) => i.productId === productId && i.unitPrice === price);
        tx.update(prodRef, { stock: stock - quantity, lastUpdated: now() });
        tx.set(db.collection(`companies/${companyId}/stockMovements`).doc(), {
          productId, productName: item.productName, type: 'OUT', quantity, fromLocationId: p.location || 'Principal',
          reason: `Conta aberta de ${tabSnap.data()?.clientName}`, userId: decoded.uid, userName: name, timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        const nextItems = same
          ? items.map((i) => (i.id === same.id ? { ...i, quantity: i.quantity + quantity, totalPrice: round2((i.quantity + quantity) * i.unitPrice) } : i))
          : [...items, item];
        tx.update(tabRef, { items: nextItems, updatedAt: now() });
        resultItems = nextItems;
      });
      return NextResponse.json({ success: true, items: resultItems });
    }

    if (action === 'dec') {
      let resultItems: TabItem[] = [];
      await db.runTransaction(async (tx) => {
        const tabSnap = await tx.get(tabRef);
        if (!tabSnap.exists || tabSnap.data()?.status !== 'open') throw new Error('Esta conta já não está aberta.');
        const items: TabItem[] = tabSnap.data()?.items || [];
        const item = items.find((i) => i.id === body.itemId);
        if (!item) throw new Error('Item não encontrado.');
        if (item.quantity <= 1) throw new Error('Para retirar o último, use o lixo e indique o motivo.');
        const prodRef = db.doc(`companies/${companyId}/products/${item.productId}`);
        const prodSnap = await tx.get(prodRef);
        if (prodSnap.exists) {
          tx.update(prodRef, { stock: (Number(prodSnap.data()?.stock) || 0) + 1, lastUpdated: now() });
          tx.set(db.collection(`companies/${companyId}/stockMovements`).doc(), {
            productId: item.productId, productName: item.productName, type: 'IN', quantity: 1, toLocationId: prodSnap.data()?.location || 'Principal',
            reason: `Menos 1 na conta de ${tabSnap.data()?.clientName}`, userId: decoded.uid, userName: name, timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        resultItems = items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - 1, totalPrice: round2((i.quantity - 1) * i.unitPrice) } : i));
        tx.update(tabRef, { items: resultItems, updatedAt: now() });
      });
      return NextResponse.json({ success: true, items: resultItems });
    }

    if (action === 'remove') {
      const reason = String(body.reason ?? '').trim().slice(0, 200);
      if (reason.length < 3) return NextResponse.json({ error: 'Indique o motivo.' }, { status: 400 });
      await db.runTransaction(async (tx) => {
        const tabSnap = await tx.get(tabRef);
        if (!tabSnap.exists || tabSnap.data()?.status !== 'open') throw new Error('Esta conta já não está aberta.');
        const items: TabItem[] = tabSnap.data()?.items || [];
        const item = items.find((i) => i.id === body.itemId);
        if (!item) throw new Error('Item não encontrado.');
        const prodRef = db.doc(`companies/${companyId}/products/${item.productId}`);
        const prodSnap = await tx.get(prodRef);
        if (prodSnap.exists) {
          tx.update(prodRef, { stock: (Number(prodSnap.data()?.stock) || 0) + item.quantity, lastUpdated: now() });
          tx.set(db.collection(`companies/${companyId}/stockMovements`).doc(), {
            productId: item.productId, productName: item.productName, type: 'IN', quantity: item.quantity, toLocationId: prodSnap.data()?.location || 'Principal',
            reason: `Item retirado da conta de ${tabSnap.data()?.clientName}: ${reason}`, userId: decoded.uid, userName: name, timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        tx.update(tabRef, { items: items.filter((i) => i.id !== item.id), updatedAt: now() });
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'close') {
      const paymentMethod = String(body.paymentMethod || '');
      if (!PAYMENTS.includes(paymentMethod)) return NextResponse.json({ error: 'Escolha a forma de pagamento.' }, { status: 400 });
      const companyRef = db.doc(`companies/${companyId}`);
      const result = await db.runTransaction(async (tx) => {
        const tabSnap = await tx.get(tabRef);
        const companySnap = await tx.get(companyRef);
        if (!tabSnap.exists || tabSnap.data()?.status !== 'open') throw new Error('Esta conta já não está aberta.');
        const t = tabSnap.data() || {};
        const items: TabItem[] = t.items || [];
        if (items.length === 0) throw new Error('A conta está vazia. Apague-a em vez de fechar.');
        const { guideNumber, saleCounter, numberingUpdate } = nextGuideNumber(companySnap.exists ? companySnap.data() || {} : {}, 'Venda a Dinheiro');
        const closedAt = new Date();
        items.forEach((it, idx) => {
          tx.set(db.collection(`companies/${companyId}/sales`).doc(), {
            date: closedAt.toISOString(), // com hora, como as outras vendas (ordena bem e conta no dia certo de Maputo)
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity,
            unit: it.unit || 'un',
            unitPrice: it.unitPrice,
            ...(it.unitCost !== undefined ? { unitCost: it.unitCost } : {}),
            subtotal: it.totalPrice,
            totalValue: it.totalPrice,
            amountPaid: it.totalPrice,
            soldBy: name,
            guideNumber,
            location: it.location || 'Principal',
            status: 'Pago',
            documentType: 'Venda a Dinheiro',
            clientName: t.clientName || 'Consumidor Final (Balcão)',
            paymentMethod,
            notes: `Conta aberta (${t.clientName}) — lançado por ${it.addedByName}`,
            transactionId: `tab-${tabId}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
          void idx;
        });
        tx.update(companyRef, { saleCounter, ...numberingUpdate });
        tx.update(tabRef, { status: 'closed', closedAt: closedAt.toISOString(), closedByName: name, paymentMethod, total: tabTotal(items), guideNumber });
        return { guideNumber, total: tabTotal(items) };
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'toRoom') {
      const stayId = String(body.stayId || '');
      if (!stayId) return NextResponse.json({ error: 'Escolha o quarto.' }, { status: 400 });
      const stayRef = db.doc(`companies/${companyId}/stays/${stayId}`);
      const result = await db.runTransaction(async (tx) => {
        const tabSnap = await tx.get(tabRef);
        const staySnap = await tx.get(stayRef);
        if (!tabSnap.exists || tabSnap.data()?.status !== 'open') throw new Error('Esta conta já não está aberta.');
        if (!staySnap.exists || staySnap.data()?.status !== 'open') throw new Error('Esse quarto já não tem uma estadia aberta.');
        const t = tabSnap.data() || {};
        const s = staySnap.data() || {};
        const items: TabItem[] = t.items || [];
        if (items.length === 0) throw new Error('A conta está vazia.');
        const moved = items.map((it, i) => ({
          id: `cons-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          addedAt: it.addedAt,
          addedBy: decoded.uid,
          addedByName: it.addedByName,
          notes: `Conta de ${t.clientName}`,
        }));
        const consumptions = [...(Array.isArray(s.consumptions) ? s.consumptions : []), ...moved];
        const consumptionsSum = consumptions.reduce((sum: number, c: any) => sum + (Number(c.totalPrice) || 0), 0);
        tx.update(stayRef, { consumptions, totalAmountDue: round2((Number(s.totalAmountDue) || 0) + tabTotal(items)), updatedAt: now() });
        tx.update(tabRef, { status: 'transferred', transferredAt: now(), transferredByName: name, stayId, roomName: s.roomName || '', total: tabTotal(items) });
        void consumptionsSum;
        return { roomName: String(s.roomName || ''), total: tabTotal(items) };
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    console.error('Erro nas contas abertas:', err);
    return NextResponse.json({ error: err?.message || 'Não foi possível processar a conta.' }, { status: 400 });
  }
}
