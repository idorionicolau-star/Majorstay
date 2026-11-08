'use client';

import { itemsSummary, saleLines } from '@/lib/sale-summary';
import { useCallback } from 'react';
import type { Product, Sale, StockMovement, CartItem } from '@/lib/types';
import { collection, doc, writeBatch, getDocs, query, where, runTransaction, getDoc, serverTimestamp, DocumentReference, limit } from 'firebase/firestore';
import { ref } from "firebase/storage";
import { downloadSaleDocument, formatCurrency } from '@/lib/utils';
import { planBulkSale, planSingleSale, planPickup, nextGuideNumber, provisionalGuideNumber } from '@/lib/sale-plan';
import { isOffline, isOfflineReadError, queueBatch, writeDeltas, writeMovements } from './offline-helpers';
import type { InventoryCore } from './core';
import type { ProductActions } from './product-actions';
import { links } from '@/lib/deep-links';
import { locationIn, pickActive } from '@/lib/product-ref';
import { expectedReserved } from '@/lib/reserved-stock';
import { addGuestSale } from '@/lib/guest-mode';

export function useSalesActions(core: InventoryCore, deps: { product_actions: ProductActions }) {
  const { isGuest, isReadOnly, toast, firestore, companyId, productsCollectionRef, companyData, isMultiLocation, locations, user, sendPush, triggerEmailAlert, setLastSaleTimestamp, products, notifyManagers, isManagerUser, productsData, salesData, ordersData } = core;
  const { checkStockAndNotify } = deps.product_actions;


  const addSale = useCallback(async (newSaleData: Omit<Sale, 'id' | 'guideNumber'>, reserveStock = true) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (isGuest) {
      const guideNumber = `VD-${new Date().getFullYear()}/${String(Math.floor(Math.random() * 800) + 200).padStart(4, '0')}`;
      const created: Sale = {
        id: `guest-sale-${Date.now()}`,
        ...newSaleData,
        guideNumber,
        soldBy: user?.username || 'Gestor Comercial',
        status: newSaleData.status || 'Pago',
      };
      addGuestSale(created);
      setLastSaleTimestamp(Date.now());
      toast({ title: 'Venda registada com sucesso!', description: `Documento ${guideNumber} emitido.` });
      return;
    }

    if (!firestore || !companyId || !productsCollectionRef) throw new Error("Firestore não está pronto.");

    const settings = companyData?.notificationSettings;
    if (settings?.onSale && (!settings.email || settings.email.trim() === '')) {
      toast({
        variant: "destructive",
        title: "E-mail de Notificação em Falta",
        description: "Ativou as notificações de venda, mas não configurou um e-mail de destino nos Ajustes.",
      });
    }

    const wantedLocation = newSaleData.location || (isMultiLocation ? locations[0]?.id : 'Principal');
    const isProformaSale = newSaleData.documentType === 'Factura Proforma';

    // Venda sem internet: grava neste aparelho com número provisório e segue sozinha quando a ligação voltar.
    const sellOfflineSingle = () => {
      const nowIso = new Date().toISOString();
      const guideNumber = provisionalGuideNumber();
      const found = (productsData || []).find(p => p.id && p.name === newSaleData.productName && p.location === wantedLocation);
      const plan = planSingleSale({
        sale: newSaleData, reserveStock: reserveStock && !isProformaSale,
        source: found ? { id: found.id as string, data: found } : null,
        user: { id: user?.id || 'unknown', username: user?.username || 'Sistema', role: user?.role },
        guideNumber, nowIso, newId: () => doc(collection(firestore, `companies/${companyId}/sales`)).id,
      });
      const batch = writeBatch(firestore);
      batch.set(doc(firestore, `companies/${companyId}/sales`, plan.sale.id), { ...plan.sale, offlinePending: true });
      writeDeltas(batch, productsCollectionRef, plan.deltas, nowIso);
      writeMovements(batch, firestore, companyId, plan.movements, { id: user?.id || 'unknown', username: user?.username || 'Sistema' }, () => 'Venda levantada no acto (offline)');
      const reviewsRef = collection(firestore, `companies/${companyId}/priceReviews`);
      plan.priceReviews.forEach(r => batch.set(doc(reviewsRef), r));
      queueBatch(batch, 'Venda feita offline', (title, description) => toast({ variant: 'destructive', title, description }));
      toast({
        title: "Venda guardada neste aparelho",
        description: `Sem internet. Recibo provisório ${guideNumber} — o número oficial é atribuído quando a ligação voltar.`,
      });
      downloadSaleDocument({ ...plan.sale, offlinePending: true } as Sale, companyData);
    };

    if (isOffline()) {
      sellOfflineSingle();
      return;
    }

    const productQuery = query(
      productsCollectionRef,
      where("name", "==", newSaleData.productName),
      where("location", "in", locationIn(newSaleData.location || (isMultiLocation ? locations[0]?.id : 'Principal')))
    );

    const salesCollectionRef = collection(firestore, `companies/${companyId}/sales`);
    const newSaleRef = doc(salesCollectionRef);
    const companyDocRef = doc(firestore, `companies/${companyId}`);

    let guideNumberForOuterScope: string | null = null;
    let referencePriceForReview = 0;
    let reviewForPush: Record<string, any> | null = null;

    const isProforma = newSaleData.documentType === 'Factura Proforma';
    const shouldReserveStock = reserveStock && !isProforma;
    const finalStatus = isProforma ? 'Pendente' : newSaleData.status;

    // This is a read outside the transaction to get the document reference.
    const productSnapshot = shouldReserveStock ? await getDocs(productQuery) : null;
    const activeProductDoc = productSnapshot ? pickActive(productSnapshot.docs) : undefined; // ignora os da lixeira
    if (shouldReserveStock && productSnapshot && !activeProductDoc) {
      throw new Error(`Produto "${newSaleData.productName}" não encontrado no estoque para a localização selecionada.`);
    }
    const productDocRef = activeProductDoc ? activeProductDoc.ref : null;

    try {
    await runTransaction(firestore, async (transaction) => {
      const companyDoc = await transaction.get(companyDocRef);
      if (!companyDoc.exists()) {
        throw new Error("Documento da empresa não encontrado.");
      }
      const currentCompanyData = companyDoc.data();
      const allNumbering = currentCompanyData.documentNumbering || {};
      const typeConfig = allNumbering[newSaleData.documentType];
      const newSaleCounter = (currentCompanyData.saleCounter || 0) + 1;

      let guideNumber: string;
      if (typeConfig && typeConfig.prefix) {
        const num = typeConfig.nextNumber || 1;
        const padded = typeConfig.padding > 0 ? String(num).padStart(typeConfig.padding, '0') : String(num);
        guideNumber = `${typeConfig.prefix}${typeConfig.separator || ''}${padded}`;
      } else {
        guideNumber = `GT-${String(newSaleCounter).padStart(6, '0')}`;
      }
      guideNumberForOuterScope = guideNumber;

      let unitCost = 0;
      if (productDocRef) {
        const productDoc = await transaction.get(productDocRef as DocumentReference);
        if (productDoc.exists()) {
          const productData = productDoc.data() as Product;
          unitCost = productData.cost || 0;
          referencePriceForReview = Number(productData.price) || 0;

          if (shouldReserveStock) {
            const availableStock = (productData.stock || 0) - (productData.reservedStock || 0);
            if (availableStock < newSaleData.quantity) {
              throw new Error(`Estoque insuficiente. Disponível: ${availableStock}.`);
            }
            if (finalStatus === 'Levantado') {
              // Levantado na hora: o material sai do stock já. Nada fica reservado.
              transaction.update(productDoc.ref, { stock: (productData.stock || 0) - newSaleData.quantity, lastUpdated: new Date().toISOString() });
              const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
                productId: productDoc.id,
                productName: newSaleData.productName,
                type: 'OUT',
                quantity: -newSaleData.quantity,
                fromLocationId: productData.location,
                reason: 'Venda levantada no acto',
                userId: user?.id || 'unknown',
                userName: user?.username || 'Sistema',
              };
              transaction.set(doc(collection(firestore, `companies/${companyId}/stockMovements`)), { ...movement, timestamp: serverTimestamp() });
            } else {
              // Pago mas por levantar: reservar.
              transaction.update(productDoc.ref, { reservedStock: (productData.reservedStock || 0) + newSaleData.quantity });
            }
          }
        }
      }

      transaction.update(companyDocRef, {
        saleCounter: newSaleCounter,
        ...(typeConfig && typeConfig.prefix ? { [`documentNumbering.${newSaleData.documentType}.nextNumber`]: (typeConfig.nextNumber || 1) + 1 } : {})
      });
      transaction.set(newSaleRef, { ...newSaleData, status: finalStatus, guideNumber, unitCost });

      // Preço de venda: aprende se o produto não tem preço; se é diferente do habitual, pede confirmação ao gestor.
      const soldPrice = Number(newSaleData.unitPrice) || 0;
      if (!isProforma && productDocRef && soldPrice > 0) {
        if (referencePriceForReview <= 0) {
          transaction.update(productDocRef as DocumentReference, { price: soldPrice });
        } else if (Math.abs(soldPrice - referencePriceForReview) >= 0.01 && user?.role !== 'Admin' && user?.role !== 'Dono') {
          reviewForPush = {
            productName: newSaleData.productName, productIds: [(productDocRef as DocumentReference).id],
            location: newSaleData.location || '', unit: newSaleData.unit || 'un',
            referencePrice: referencePriceForReview, soldPrice, quantity: newSaleData.quantity,
            saleId: newSaleRef.id, guideNumber, clientName: newSaleData.clientName || '',
            soldBy: user?.username || '', soldById: user?.id || '', status: 'pending', createdAt: new Date().toISOString(),
          };
          transaction.set(doc(collection(firestore, `companies/${companyId}/priceReviews`)), reviewForPush);
        }
      }
    });
    } catch (e) {
      // A ligação caiu antes de gravar qualquer coisa: repete no modo offline em vez de perder a venda.
      if (isOfflineReadError(e)) { sellOfflineSingle(); return; }
      throw e;
    }

    if (reviewForPush) {
      const r = reviewForPush as Record<string, any>;
      sendPush({
        title: `💲 Preço diferente numa venda — confirmar`,
        body: `${r.productName}: vendido a ${formatCurrency(r.soldPrice)} (habitual ${formatCurrency(r.referencePrice)}) por ${r.soldBy}`,
        link: '/sales/precos',
        tag: 'price-review',
        type: 'price',
        audience: 'managers',
      });
    }

    if (guideNumberForOuterScope) {
      const createdSale: Sale = {
        ...newSaleData,
        id: newSaleRef.id,
        guideNumber: guideNumberForOuterScope,
      };
      downloadSaleDocument(createdSale, companyData);

      await triggerEmailAlert({
        type: 'SALE',
        ...newSaleData,
        guideNumber: guideNumberForOuterScope,
        location: locations.find(l => l.id === newSaleData.location)?.name || 'Principal',
      });

      // Trigger stock alert check after sale
      if (productDocRef) {
        getDoc(productDocRef as DocumentReference).then(docSnap => {
          if (docSnap.exists()) {
            checkStockAndNotify(docSnap.data() as Product);
          }
        });
      }
    }

    setLastSaleTimestamp(Date.now());
  }, [isGuest, firestore, companyId, productsCollectionRef, isMultiLocation, locations, companyData, productsData, toast, triggerEmailAlert, user, sendPush]);


  const addBulkSale = useCallback(async (
    items: CartItem[],
    saleData: {
      customerId?: string;
      clientName?: string;
      documentType: Sale['documentType'];
      notes?: string;
      discount?: { type: 'fixed' | 'percentage'; value: number };
      applyVat: boolean;
      vatPercentage: number;
      isPickedUp?: boolean;
      /** ISO date for sales registered late (defaults to now) */
      date?: string;
      /** Numerário, M-Pesa, e-Mola, Transferência, POS… (defaults to Numerário) */
      paymentMethod?: string;
      /** Amount received now; less than the total leaves the rest as debt (defaults to full) */
      amountPaid?: number;
    }
  ) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (isGuest) {
      const nowIso = saleData.date || new Date().toISOString();
      const guideNumber = `VD-${new Date().getFullYear()}/${String(Math.floor(Math.random() * 800) + 200).padStart(4, '0')}`;
      const created: Sale[] = items.map((item, idx) => ({
        id: `guest-sale-${Date.now()}-${idx}`,
        date: nowIso,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit || 'un',
        unitPrice: item.unitPrice,
        unitCost: item.originalCost || item.unitPrice * 0.75,
        subtotal: item.subtotal,
        totalValue: item.subtotal,
        amountPaid: item.subtotal,
        soldBy: user?.username || 'Gestor Comercial',
        guideNumber,
        location: item.location || 'Armazém Principal',
        customerId: saleData.customerId,
        clientName: saleData.clientName || 'Consumidor Final (Balcão)',
        status: 'Pago',
        documentType: saleData.documentType || 'Venda a Dinheiro',
        paymentMethod: saleData.paymentMethod || 'Numerário',
        transactionId: `txn-${Date.now()}`,
      }));
      created.forEach(addGuestSale);
      setLastSaleTimestamp(Date.now());
      toast({
        title: 'Venda registada com sucesso!',
        description: `Documento ${guideNumber} emitido. O stock e os relatórios foram actualizados.`,
      });
      return created;
    }

    if (!firestore || !companyId || !productsCollectionRef || !user) throw new Error("Firestore não está pronto.");
    if (!items || items.length === 0) throw new Error("O carrinho está vazio.");

    const salesCollectionRef = collection(firestore, `companies/${companyId}/sales`);
    const companyDocRef = doc(firestore, `companies/${companyId}`);
    const defaultLocation = (isMultiLocation && locations.length > 0 ? locations[0]?.id : 'Principal') || 'Principal';
    const planUser = { id: user.id, username: user.username, role: user.role };
    const newId = () => doc(salesCollectionRef).id;

    let guideNumberForOuterScope: string | null = null;
    let createdSalesForOuterScope: Sale[] = [];
    let pendingPriceReviews: Record<string, any>[] = [];
    let cartSubtotal = 0;
    let totalDiscountAmount = 0;
    let cartTotal = 0;
    let wasOffline = false;

    // Todos os registos de stock que podem estar por trás de cada linha do carrinho
    const allSourceIds = new Set<string>();
    items.forEach(item => {
      const targetLoc = item.location || defaultLocation;
      const aggregatedProduct = products.find(p =>
        p.name === item.productName &&
        (!isMultiLocation || p.location === targetLoc || (!p.location && (targetLoc === 'Principal' || !item.location)))
      );
      if (aggregatedProduct?.sourceIds) {
        aggregatedProduct.sourceIds.forEach(id => allSourceIds.add(id));
      } else if (item.productId) {
        allSourceIds.add(item.productId);
      }
    });

    // Venda sem internet: grava neste aparelho com número provisório e segue sozinha quando a ligação voltar.
    const sellOffline = () => {
      const nowIso = new Date().toISOString();
      const guideNumber = provisionalGuideNumber();
      const sources = (productsData || []).filter(p => p.id && allSourceIds.has(p.id)).map(p => ({ id: p.id as string, data: p }));
      const plan = planBulkSale({ items, saleData, sources, isMultiLocation, defaultLocation, user: planUser, guideNumber, nowIso, newId });
      const batch = writeBatch(firestore);
      plan.sales.forEach(sale => batch.set(doc(salesCollectionRef, sale.id), { ...sale, offlinePending: true }));
      writeDeltas(batch, productsCollectionRef, plan.deltas, nowIso);
      writeMovements(batch, firestore, companyId, plan.movements, user, () => `Venda ${guideNumber} (levantada no acto, offline)`);
      const reviewsRef = collection(firestore, `companies/${companyId}/priceReviews`);
      plan.priceReviews.forEach(r => batch.set(doc(reviewsRef), r));
      queueBatch(batch, 'Venda feita offline', (title, description) => toast({ variant: 'destructive', title, description }));
      guideNumberForOuterScope = guideNumber;
      createdSalesForOuterScope = plan.sales.map(x => ({ ...x, offlinePending: true } as Sale));
      cartSubtotal = plan.cartSubtotal; totalDiscountAmount = plan.totalDiscountAmount; cartTotal = plan.cartTotal;
      wasOffline = true;
    };

    const sellOnline = () => runTransaction(firestore, async (transaction) => {
      // 1. READS
      const companyDoc = await transaction.get(companyDocRef);
      if (!companyDoc.exists()) throw new Error("Empresa não encontrada.");

      const sourceDocRefs = Array.from(allSourceIds).map(id => doc(productsCollectionRef, id));
      const sourceSnaps = await Promise.all(sourceDocRefs.map(ref => transaction.get(ref)));
      const loaded = sourceSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ref: s.ref, data: s.data() as Product }));

      // 2. CONTAS (as mesmas da venda offline)
      const numbering = nextGuideNumber(companyDoc.data(), saleData.documentType);
      const nowIso = new Date().toISOString();
      const plan = planBulkSale({
        items, saleData, sources: loaded.map(l => ({ id: l.id, data: l.data })),
        isMultiLocation, defaultLocation, user: planUser, guideNumber: numbering.guideNumber, nowIso, newId,
      });
      guideNumberForOuterScope = numbering.guideNumber;
      createdSalesForOuterScope = plan.sales;
      pendingPriceReviews = plan.priceReviews;
      cartSubtotal = plan.cartSubtotal; totalDiscountAmount = plan.totalDiscountAmount; cartTotal = plan.cartTotal;

      // 3. WRITES
      const priceReviewsRef = collection(firestore, `companies/${companyId}/priceReviews`);
      plan.priceReviews.forEach(r => transaction.set(doc(priceReviewsRef), r));
      transaction.update(companyDocRef, { saleCounter: numbering.saleCounter, ...numbering.numberingUpdate });

      for (const d of plan.deltas) {
        const base = loaded.find(l => l.id === d.id)!;
        transaction.update(base.ref, {
          ...(d.stock || d.reserved ? { stock: (base.data.stock || 0) + d.stock, reservedStock: (base.data.reservedStock || 0) + d.reserved } : {}),
          ...(d.price !== undefined ? { price: d.price } : {}),
          lastUpdated: nowIso,
        });
      }

      const bulkMovementsRef = collection(firestore, `companies/${companyId}/stockMovements`);
      plan.movements.forEach(m => {
        const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
          productId: m.productId,
          productName: m.productName,
          type: 'OUT',
          quantity: -m.quantity,
          fromLocationId: m.location,
          reason: `Venda ${numbering.guideNumber} (levantada no acto)`,
          userId: user.id,
          userName: user.username,
        };
        transaction.set(doc(bulkMovementsRef), { ...movement, timestamp: serverTimestamp() });
      });

      plan.sales.forEach(sale => transaction.set(doc(salesCollectionRef, sale.id), sale));
    });

    if (isOffline()) {
      sellOffline();
    } else {
      try {
        await sellOnline();
      } catch (e) {
        // A ligação caiu antes de gravar qualquer coisa: repete no modo offline em vez de perder a venda.
        if (!isOfflineReadError(e)) throw e;
        sellOffline();
      }
    }

    if (wasOffline) {
      toast({
        title: "Venda guardada neste aparelho",
        description: `Sem internet. Recibo provisório ${guideNumberForOuterScope} — o número oficial é atribuído quando a ligação voltar.`,
      });
      // o documento já não abre sozinho: quem vende escolhe a seguir (imprimir, PDF, WhatsApp…)
      return createdSalesForOuterScope;
    }

    // Desconto grande (≥ 10%) → avisar o gestor.
    if (cartSubtotal > 0 && totalDiscountAmount / cartSubtotal >= 0.1) {
      notifyManagers({
        type: 'security',
        title: `🏷️ Desconto de ${Math.round((totalDiscountAmount / cartSubtotal) * 100)}% numa venda`,
        body: `${user.username} · ${formatCurrency(totalDiscountAmount)} de desconto em ${formatCurrency(cartSubtotal)}${saleData.clientName ? ` · ${saleData.clientName}` : ''}`,
        link: guideNumberForOuterScope ? links.sale(guideNumberForOuterScope) : '/sales',
      });
    }

    // Preço diferente do habitual → avisar o gestor (push) para confirmar.
    if (pendingPriceReviews.length) {
      const first = pendingPriceReviews[0];
      sendPush({
        title: `💲 Preço diferente numa venda — confirmar`,
        body: pendingPriceReviews.length === 1
          ? `${first.productName}: vendido a ${formatCurrency(first.soldPrice)} (habitual ${formatCurrency(first.referencePrice)}) por ${first.soldBy}`
          : `${pendingPriceReviews.length} produtos vendidos com preço diferente do habitual por ${first.soldBy}`,
        link: '/sales/precos',
        tag: 'price-review',
        type: 'price',
        audience: 'managers',
      });
    }

    // Post-transaction UI/Notifications
    if (guideNumberForOuterScope && createdSalesForOuterScope.length > 0) {
      // a confirmação (✓ e "E agora?") é mostrada por quem vende; aqui só os avisos e o email
      await triggerEmailAlert({
        type: 'SALE',
        ...createdSalesForOuterScope[0], // cliente, vendedor, estado…
        // todos os produtos da venda (antes o email levava só o primeiro)
        productName: itemsSummary(createdSalesForOuterScope.map((s) => s.productName)),
        items: saleLines(createdSalesForOuterScope),
        totalValue: cartTotal, // overriding total for single sum
        guideNumber: guideNumberForOuterScope,
        location: locations.find(l => l.id === createdSalesForOuterScope[0].location)?.name || 'Principal',
      });

      // Trigger stock alert checks for all items in bulk sale using fresh data
      items.forEach(item => {
        const targetLocation = item.location || (isMultiLocation && locations.length > 0 ? locations[0]?.id : 'Principal');
        const pQuery = query(
          productsCollectionRef,
          where("name", "==", item.productName),
          where("location", "in", locationIn(targetLocation)),
          limit(1)
        );
        getDocs(pQuery).then(snap => {
          if (!snap.empty) {
            checkStockAndNotify(snap.docs[0].data() as Product);
          }
        });
      });
    }

    setLastSaleTimestamp(Date.now());
    return createdSalesForOuterScope;
  }, [isGuest, firestore, companyId, productsCollectionRef, isMultiLocation, locations, companyData, products, productsData, toast, triggerEmailAlert, sendPush, user, notifyManagers]);



  const confirmSalePickup = useCallback(async (sale: Sale) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !productsCollectionRef || !user) throw new Error("Firestore não está pronto.");

    const saleRef = doc(firestore, `companies/${companyId}/sales`, sale.id);
    const offlineMode = isOffline();
    let freshSale: Sale = sale; // offline usa a venda que está no ecrã (já vem da cópia local)
    if (!offlineMode) {
      try {
        const saleSnap = await getDoc(saleRef);
        if (!saleSnap.exists()) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Venda não encontrada.' });
          return;
        }
        freshSale = saleSnap.data() as Sale;
      } catch (e) {
        if (!isOfflineReadError(e)) throw e;
      }
    }

    if (freshSale.status === 'Levantado') {
      throw new Error("Esta venda já foi marcada como levantada. O stock não foi alterado.");
    }

    // Vendas de encomenda são levantadas em Encomendas → "Finalizar / Levantar",
    // que também regista a produção. Levantar aqui descontava o stock duas vezes.
    if (freshSale.orderId || freshSale.documentType === 'Encomenda') {
      throw new Error("Esta venda pertence a uma encomenda. Use Encomendas → Finalizar / Levantar.");
    }

    const amountPaid = freshSale.amountPaid ?? 0;
    if ((freshSale.totalValue - amountPaid) > 0.5) {
      throw new Error(`Pagamento incompleto. O cliente ainda precisa de pagar ${formatCurrency(freshSale.totalValue - amountPaid)}.`);
    }

    const targetLocation = freshSale.location || (isMultiLocation ? locations[0]?.id : 'Principal');
    const aggregatedProduct = products.find(p =>
      p.name === freshSale.productName &&
      (!isMultiLocation || p.location === targetLocation || (!p.location && (targetLocation === 'Principal' || !freshSale.location)))
    );

    let sourceIdsToCheck: string[] = [];
    if (aggregatedProduct?.sourceIds && aggregatedProduct.sourceIds.length > 0) {
      sourceIdsToCheck = aggregatedProduct.sourceIds;
    } else if (freshSale.productId) {
      sourceIdsToCheck = [freshSale.productId];
    } else {
      // Fallback query if not in context
      const productQuery = query(
        productsCollectionRef,
        where("name", "==", freshSale.productName),
        where("location", "in", locationIn(targetLocation))
      );
      const snap = await getDocs(productQuery);
      if (!snap.empty) {
        sourceIdsToCheck = snap.docs.map(d => d.id);
      }
    }

    if (sourceIdsToCheck.length === 0) {
      throw new Error(`Produto "${freshSale.productName}" não encontrado para atualizar estoque.`);
    }

    // Levantamento sem internet: grava neste aparelho e sincroniza depois (incrementos atómicos).
    const pickupOffline = () => {
      const nowIso = new Date().toISOString();
      const sources = (productsData || []).filter(p => p.id && sourceIdsToCheck.includes(p.id)).map(p => ({ id: p.id as string, data: p }));
      const plan = planPickup({ quantity: freshSale.quantity, sources });
      if ('error' in plan) {
        throw new Error(`Erro Crítico: Stock insuficiente para realizar o levantamento. Disp: ${plan.error}, Necessário: ${freshSale.quantity}`);
      }
      const batch = writeBatch(firestore);
      writeDeltas(batch, productsCollectionRef, plan.deltas, nowIso);
      writeMovements(batch, firestore, companyId, plan.movements.map(m => ({ ...m, productName: freshSale.productName })), user,
        () => `Levantamento Venda #${freshSale.guideNumber} (offline)`);
      batch.update(saleRef, { status: 'Levantado' });
      queueBatch(batch, 'Levantamento feito offline', (title, description) => toast({ variant: 'destructive', title, description }));
      toast({ title: 'Levantamento guardado neste aparelho', description: 'Sem internet. Sincroniza sozinho quando a ligação voltar.' });
    };

    if (offlineMode) {
      pickupOffline();
      return;
    }

    try {
    await runTransaction(firestore, async (transaction) => {
      // 1. READS
      const sourceDocRefs = sourceIdsToCheck.map(id => doc(productsCollectionRef, id));
      const sourceSnaps = await Promise.all(sourceDocRefs.map(ref => transaction.get(ref)));

      const loadedProducts = sourceSnaps.filter(s => s.exists()).map(s => ({ ref: s.ref, data: s.data() as Product }));

      if (loadedProducts.length === 0) {
        throw new Error(`Produto "${freshSale.productName}" não encontrado na base de dados.`);
      }

      // Check total available BEFORE deducting
      const totalStock = loadedProducts.reduce((sum, p) => sum + p.data.stock, 0);
      if (totalStock < freshSale.quantity) {
        throw new Error(`Erro Crítico: Stock insuficiente para realizar o levantamento. Disp: ${totalStock}, Necessário: ${freshSale.quantity}`);
      }

      // 2. CALCULATIONS & WRITES
      let remainingToDeduct = freshSale.quantity;
      const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);

      // Libertar a reserva onde ela está (pode estar num documento diferente do que tem o stock).
      let reservedToRelease = freshSale.quantity;
      const next = new Map(loadedProducts.map(p => [p.ref.id, { stock: p.data.stock || 0, reserved: p.data.reservedStock || 0 }]));
      for (const source of loadedProducts) {
        if (reservedToRelease <= 0) break;
        const st = next.get(source.ref.id)!;
        const release = Math.min(st.reserved, reservedToRelease);
        st.reserved -= release;
        reservedToRelease -= release;
      }

      for (const source of loadedProducts) {
        if (remainingToDeduct <= 0) break;

        const st = next.get(source.ref.id)!;
        if (st.stock > 0) {
          const deductAmount = Math.min(st.stock, remainingToDeduct);
          st.stock -= deductAmount;

          // Movement log per document modified
          const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
            productId: source.ref.id,
            productName: freshSale.productName,
            type: 'OUT',
            quantity: -deductAmount,
            fromLocationId: source.data.location,
            reason: `Levantamento Venda #${freshSale.guideNumber}`,
            userId: user.id,
            userName: user.username,
          };
          transaction.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });

          remainingToDeduct -= deductAmount;
        }
      }

      // Uma única escrita por documento (stock e reserva já calculados)
      for (const source of loadedProducts) {
        const st = next.get(source.ref.id)!;
        if (st.stock !== (source.data.stock || 0) || st.reserved !== (source.data.reservedStock || 0)) {
          transaction.update(source.ref, { stock: st.stock, reservedStock: st.reserved, lastUpdated: new Date().toISOString() });
        }
      }

      transaction.update(saleRef, { status: 'Levantado' });

      // Side effect post-transaction logic
      // Send notification with total remaining stock
      checkStockAndNotify({ ...loadedProducts[0].data, stock: totalStock - freshSale.quantity });
    });
    } catch (e) {
      if (isOfflineReadError(e)) { pickupOffline(); return; }
      throw e;
    }

  }, [firestore, companyId, productsCollectionRef, isMultiLocation, locations, user, checkStockAndNotify, toast, productsData, products]);


  const deleteSale = useCallback(async (saleId: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !productsCollectionRef || !user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A base de dados não está pronta.' });
      return;
    }
    if (!isManagerUser) {
      toast({ variant: 'destructive', title: 'Só o gestor pode apagar vendas', description: 'Peça ao gestor para apagar ou corrigir esta venda.' });
      return;
    }
    const saleRef = doc(firestore, `companies/${companyId}/sales`, saleId);

    try {
      const saleDoc = await getDoc(saleRef);
      if (!saleDoc.exists()) {
        throw new Error("Venda não encontrada.");
      }
      const saleData = saleDoc.data() as Sale;
      if (saleData.orderId) {
        // A reserva desta venda pertence à encomenda: apagar só a venda libertava-a duas vezes (aqui e ao entregar).
        toast({ variant: 'destructive', title: 'Venda de encomenda', description: 'Apague a encomenda (em Encomendas): a venda e a reserva saem juntas.' });
        return;
      }

      let productDocRef: DocumentReference | null = null;
      if (saleData.status === 'Pago' || saleData.status === 'Levantado') {
        const productQuery = query(
          productsCollectionRef,
          where("name", "==", saleData.productName),
          where("location", "in", locationIn(saleData.location || (isMultiLocation ? locations[0]?.id : 'Principal')))
        );
        const productSnapshot = await getDocs(productQuery);
        productDocRef = pickActive(productSnapshot.docs)?.ref ?? null;
      }

      await runTransaction(firestore, async (transaction) => {
        // We reinstate stock because "Deleting" a sale usually means it was valid but we want to cancel it.
        // Soft delete logic: Just mark as deleted? If we mark as deleted but keep stock deducted, it's just hiding.
        // User expects "Undo" usually for accidental deletion.
        // If we want "Undo" to work perfectly, we should NOT revert stock on soft delete if we assume it's just moving to trash,
        // BUT if we don't revert stock, the stock count is wrong if the sale is indeed cancelled.
        // Plan: Soft delete = "Cancelled" effectively. So we revert stock.
        // Restore = "Re-do" sale. We take stock again.

        if (productDocRef) {
          const productDoc = await transaction.get(productDocRef);
          if (productDoc.exists()) {
            const productData = productDoc.data() as Product;
            let stockUpdate = {};

            // If it was just 'Pago' (reserved), we free reserved.
            // If it was 'Levantado' (stock taken), we free stock AND reserved? No, just stock.
            // Wait, logic:
            // Pago -> Reserved Stock increased.
            // Levantado -> Stock decreased (Reserved decreased).

            if (saleData.status === 'Pago') {
              const newReserved = Math.max(0, productData.reservedStock - saleData.quantity);
              stockUpdate = { reservedStock: newReserved };
            } else if (saleData.status === 'Levantado') {
              // Stock was already taken. Put it back.
              const newStock = productData.stock + saleData.quantity;
              stockUpdate = { stock: newStock };
            }

            transaction.update(productDocRef, stockUpdate);
          }
        }

        // Soft delete the sale document
        transaction.update(saleRef, {
          deletedAt: new Date().toISOString(),
          deletedBy: user.username
        });
        // Fica registado quem apagou, quando e o que era a venda (histórico imutável)
        transaction.set(doc(collection(saleRef, 'history')), {
          action: 'apagada',
          userId: user.id,
          userName: user.username,
          at: serverTimestamp(),
          guideNumber: saleData.guideNumber || null,
          snapshot: {
            productName: saleData.productName, quantity: saleData.quantity, unitPrice: saleData.unitPrice,
            totalValue: saleData.totalValue, status: saleData.status, clientName: saleData.clientName || null,
          },
        });
      });

      toast({ title: 'Venda enviada para Lixeira', description: 'O stock foi reposto.' });
      notifyManagers({
        type: 'security',
        title: `🗑️ Venda ${saleData.guideNumber || ''} apagada`,
        body: `${user.username} · ${saleData.productName} × ${saleData.quantity} · ${formatCurrency(saleData.totalValue || 0)}${saleData.clientName ? ` · ${saleData.clientName}` : ''}`,
        link: '/sales',
      });

    } catch (error: any) {
      console.error("Error deleting sale: ", error);
      toast({ variant: 'destructive', title: 'Erro ao Apagar Venda', description: error.message });
    }
  }, [firestore, companyId, productsCollectionRef, isMultiLocation, locations, toast, user, notifyManagers, isManagerUser]);


  /**
   * Acerta o stock reservado com o que as vendas pagas por levantar e as encomendas activas justificam
   * (ver lib/reserved-stock). `only`: só estes documentos de produto; sem isso, todos.
   * Deixa um registo no histórico de movimentos por cada produto corrigido.
   */
  const recalculateReservedStock = useCallback(async (only?: string[]) => {
    if (!firestore || !companyId || !productsData || !salesData || !ordersData) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A base de dados não está pronta para esta operação.' });
      return;
    }
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    try {
      const plan = expectedReserved(productsData as any[], salesData, ordersData, isMultiLocation)
        .filter((x) => x.current !== x.expected && (!only || only.includes(x.id)));
      if (!plan.length) {
        toast({ title: 'Tudo certo!', description: 'O stock reservado bate certo com as vendas e encomendas.' });
        return;
      }
      const byId = new Map(productsData.map((p) => [p.id, p]));
      const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);
      for (let i = 0; i < plan.length; i += 200) {
        const batch = writeBatch(firestore);
        plan.slice(i, i + 200).forEach((x) => {
          const p = byId.get(x.id)!;
          batch.update(doc(firestore, `companies/${companyId}/products`, x.id), { reservedStock: x.expected, lastUpdated: new Date().toISOString() });
          batch.set(doc(movementsRef), {
            productId: x.id, productName: p.name, type: 'ADJUSTMENT', quantity: 0, toLocationId: p.location,
            reason: `Reserva corrigida: de ${x.current} para ${x.expected} (${x.current > x.expected ? 'sem venda nem encomenda por trás' : 'havia vendas/encomendas por reservar'})`,
            userId: user?.id || 'sistema', userName: user?.username || 'Sistema', timestamp: serverTimestamp(),
          });
        });
        // sem internet o commit só termina quando a ligação volta: já está guardado neste aparelho
        if (isOffline()) batch.commit().catch(() => { }); else await batch.commit();
      }
      toast({ title: 'Reservas corrigidas', description: `${plan.length} produto${plan.length === 1 ? '' : 's'} com o stock reservado acertado.` });
    } catch (error: any) {
      console.error("Error recalculating reserved stock:", error);
      toast({ variant: 'destructive', title: 'Erro ao recalcular', description: 'Não foi possível completar a operação. Tente de novo.' });
    }
  }, [firestore, companyId, productsData, salesData, ordersData, isMultiLocation, isReadOnly, toast, user]);
  return { addSale, addBulkSale, confirmSalePickup, deleteSale, recalculateReservedStock };
}

export type SalesActions = ReturnType<typeof useSalesActions>;
