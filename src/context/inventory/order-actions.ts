'use client';

import { useCallback } from 'react';
import type { Product, Sale, Order } from '@/lib/types';
import { collection, doc, getDocs, query, where, runTransaction, getDoc, serverTimestamp, DocumentReference, limit } from 'firebase/firestore';
import { ref } from "firebase/storage";
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { InventoryCore } from './core';
import { orderToDeliver, orderToProduce, planPartialDelivery, reservedToRelease } from '@/lib/order-stock';
import { resolveInventoryProductRef } from '@/lib/product-ref';
import { applyMaterialUse, assertMaterialEnough, readMaterialUse } from '@/lib/production-materials';

export function useOrderActions(core: InventoryCore) {
  const { isReadOnly, toast, ordersCollectionRef, firestore, companyId, user, assertOnline, ordersData, isMultiLocation, locations, recipesData } = core;


  const deleteOrder = useCallback(async (orderId: string) => {
    assertOnline('apagar a encomenda');
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!ordersCollectionRef || !firestore || !companyId) return;

    try {
      const orderRef = doc(ordersCollectionRef, orderId);
      const orderSnap = await getDoc(orderRef);

      if (orderSnap.exists()) {
        const orderData = orderSnap.data() as Order;

        // Find the associated sale to soft-delete it too
        const salesRef = collection(firestore, `companies/${companyId}/sales`);
        const saleQuery = query(salesRef, where('orderId', '==', orderId), limit(1));
        const saleSnap = await getDocs(saleQuery);
        const associatedSaleRef = !saleSnap.empty ? saleSnap.docs[0].ref : null;

        // If order is pending or in production, we need to release the Reserved Stock
        // Concluída = já produzida mas ainda por entregar: a reserva continua presa até à entrega, por isso também se liberta
        if ((orderData.status === 'Pendente' || orderData.status === 'Em produção' || orderData.status === 'Concluída') && orderData.productId) {
          // ID do inventário, ID do catálogo ou nome → o produto do inventário (activo) nessa localização
          const resolvedProductRef: DocumentReference | null = await resolveInventoryProductRef(firestore, companyId, {
            productId: orderData.productId,
            productName: orderData.productName,
            location: orderData.location || 'Principal',
          });

          await runTransaction(firestore, async (transaction) => {
            if (resolvedProductRef) {
              const pDoc = await transaction.get(resolvedProductRef);
              if (pDoc.exists()) {
                const pData = pDoc.data() as Product;
                const currentReserved = pData.reservedStock || 0;
                const quantityToRelease = reservedToRelease(orderData);
                const newReserved = Math.max(0, currentReserved - quantityToRelease);

                transaction.update(resolvedProductRef, {
                  reservedStock: newReserved,
                  lastUpdated: new Date().toISOString()
                });
              }
            }
            // Soft delete the order
            transaction.update(orderRef, { deletedAt: new Date().toISOString() });
            // Also soft delete the associated sale
            if (associatedSaleRef) {
              transaction.update(associatedSaleRef, { deletedAt: new Date().toISOString(), deletedBy: user?.username || 'Sistema' });
            }
          });
        } else {
          // Standard soft delete for completed/delivered orders (stock was already handled)
          updateDocumentNonBlocking(orderRef, { deletedAt: new Date().toISOString() });
          if (associatedSaleRef) {
            updateDocumentNonBlocking(associatedSaleRef, { deletedAt: new Date().toISOString(), deletedBy: user?.username || 'Sistema' });
          }
        }
        toast({ title: 'Encomenda movida para Lixeira', description: 'A venda associada também foi removida.' });
      }
    } catch (e: any) {
      console.error("Error deleting order:", e);
      toast({ variant: 'destructive', title: 'Erro ao Apagar', description: e.message });
    }
  }, [ordersCollectionRef, firestore, companyId, toast, user]);


  const finalizeOrder = useCallback(async (orderId: string, finalPayment: number) => {
    assertOnline('entregar a encomenda');
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !user) return;

    try {
      // 1. Get Sale ID (outside transaction query)
      const salesRef = collection(firestore, `companies/${companyId}/sales`);
      const q = query(salesRef, where("orderId", "==", orderId));
      const salesSnap = await getDocs(q);
      const saleDoc = salesSnap.docs[0];

      // O productId pode ser o do inventário, o do catálogo ou o nome (encomendas antigas): resolve o produto activo
      const orderPre = ordersData?.find(o => o.id === orderId);
      const resolvedProductRef: DocumentReference | null = orderPre
        ? await resolveInventoryProductRef(firestore, companyId, {
            productId: orderPre.productId,
            productName: orderPre.productName,
            location: orderPre.location || (isMultiLocation ? locations[0]?.id : 'Principal') || 'Principal',
          })
        : null;

      // Quanto faltou no stock ao entregar (o stock não fica negativo, mas o gestor tem de saber)
      let shortfall = 0;

      await runTransaction(firestore, async (transaction) => {
        // --- READS ---

        // 1. Get Order
        const orderRef = doc(firestore, `companies/${companyId}/orders`, orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Encomenda não encontrada.");
        const orderData = orderSnap.data() as Order;
        if (orderData.status === 'Entregue') throw new Error("Esta encomenda já foi entregue.");

        // 2. Get Sale (if exists)
        let freshSaleData: Sale | null = null;
        let saleRef: DocumentReference | null = null;
        if (saleDoc) {
          saleRef = doc(firestore, `companies/${companyId}/sales`, saleDoc.id);
          const freshSaleSnap = await transaction.get(saleRef);
          if (freshSaleSnap.exists()) {
            freshSaleData = freshSaleSnap.data() as Sale;
          }
        }

        // 3. Get Product (if exists)
        let freshProductData: Product | null = null;
        let productRef: DocumentReference | null = resolvedProductRef;
        if (productRef) {
          const productSnap = await transaction.get(productRef);
          if (productSnap.exists()) {
            freshProductData = productSnap.data() as Product;
          }
        }
        // Sem produto no inventário não há de onde tirar o stock: entregar aqui deixava a encomenda "Entregue" sem mexer em nada.
        if (!productRef || !freshProductData) {
          throw new Error(`O produto "${orderData.productName}" já não existe no inventário. Volte a criá-lo ou corrija o nome antes de entregar.`);
        }
        // Se a venda já foi levantada pelo ecrã de Vendas, o stock já saiu — não descontar outra vez.
        const stockAlreadyOut = freshSaleData?.status === 'Levantado';

        // A parte que ainda não foi produzida é produzida agora: gasta a matéria-prima da receita (lê antes de escrever)
        const missingNow = orderToProduce(orderData);
        // o que o cliente já levou em levantamentos parciais já saiu do stock
        const toDeliver = orderToDeliver(orderData);
        const materials = productRef && freshProductData && missingNow > 0
          ? await readMaterialUse(transaction, firestore, companyId, recipesData ?? undefined, orderData.productName, missingNow)
          : [];
        assertMaterialEnough(materials);

        // --- WRITES ---

        // 4. Update Sale
        if (saleRef && freshSaleData) {
          const newAmountPaid = (freshSaleData.amountPaid || 0) + finalPayment;
          transaction.update(saleRef, {
            amountPaid: newAmountPaid,
            status: 'Levantado',
            paymentStatus: newAmountPaid >= freshSaleData.totalValue ? 'Pago' : 'Parcial'
          });
        }

        // 5. Update Order Status
        transaction.update(orderRef, { status: 'Entregue', quantityDelivered: orderData.quantity });

        // 6. Create Production Record & Stock Movements
        if (productRef && freshProductData) {
          const locationToUse = orderData.location || (isMultiLocation ? locations[0]?.id : 'Principal');
          const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);

          // Parte já produzida (registos de produção / conclusão) JÁ entrou no stock.
          // Só a parte em falta é produzida agora.
          const missing = missingNow;

          if (missing > 0) {
            applyMaterialUse(transaction, materials, -1);
            const productionsRef = collection(firestore, `companies/${companyId}/productions`);
            transaction.set(doc(productionsRef), {
              date: new Date().toISOString().split('T')[0],
              productName: orderData.productName || 'Produto Desconhecido',
              quantity: missing,
              unit: orderData.unit || 'un',
              registeredBy: user.username || 'Sistema',
              status: 'Concluído',
              location: locationToUse,
              orderId: orderId
            });
            transaction.set(doc(movementsRef), {
              productId: productRef.id,
              productName: orderData.productName,
              type: 'IN',
              quantity: missing,
              toLocationId: locationToUse,
              reason: `Produção (Encomenda #${orderId.slice(-6).toUpperCase()}): ${missing} ${orderData.unit || 'un'}`,
              userId: user.id,
              userName: user.username,
              timestamp: serverTimestamp()
            });
          }

          if (!stockAlreadyOut) {
            transaction.set(doc(movementsRef), {
              productId: productRef.id,
              productName: orderData.productName,
              type: 'OUT',
              quantity: -toDeliver,
              fromLocationId: locationToUse,
              reason: `Venda (Levantamento Encomenda #${orderId.slice(-6).toUpperCase()}): ${toDeliver} ${orderData.unit || 'un'}`,
              userId: user.id,
              userName: user.username,
              ...(saleRef ? { saleId: saleRef.id } : {}),
              timestamp: serverTimestamp()
            });
          }

          // Stock: + parte produzida agora − entregue (se ainda não saiu). Reserva: libertada.
          const newStock = (freshProductData.stock || 0) + missing - (stockAlreadyOut ? 0 : toDeliver);
          const newReserved = stockAlreadyOut ? (freshProductData.reservedStock || 0) : Math.max(0, (freshProductData.reservedStock || 0) - reservedToRelease(orderData));
          shortfall = Math.max(0, -newStock);
          transaction.update(productRef, {
            stock: Math.max(0, newStock),
            reservedStock: newReserved,
            lastUpdated: new Date().toISOString()
          });
        }
      });

      toast(shortfall > 0
        ? { variant: 'destructive', title: 'Encomenda entregue, mas faltava stock', description: `O stock não chegava: faltavam ${shortfall} un. O stock ficou a 0 — faça uma auditoria ao produto.` }
        : { title: 'Encomenda Finalizada', description: 'A produção foi registada e o stock atualizado.' });

    } catch (e: any) {
      console.error("Error finalizing order:", e);
      toast({ variant: 'destructive', title: 'Erro ao Finalizar', description: e.message });
    }
  }, [firestore, companyId, user, toast, isMultiLocation, locations, ordersData, recipesData]);
  /** O cliente leva já uma parte da encomenda, do que há em stock (o resto fica à espera; ver planPartialDelivery). */
  const deliverOrderPart = useCallback(async (orderId: string, qty: number): Promise<boolean> => {
    assertOnline('registar o levantamento');
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return false;
    }
    if (!firestore || !companyId || !user) return false;
    const orderPre = ordersData?.find(o => o.id === orderId);
    if (!orderPre) return false;
    try {
      const productRef = await resolveInventoryProductRef(firestore, companyId, {
        productId: orderPre.productId,
        productName: orderPre.productName,
        location: orderPre.location || (isMultiLocation ? locations[0]?.id : 'Principal') || 'Principal',
      });
      if (!productRef) throw new Error(`O produto "${orderPre.productName}" não existe no inventário.`);
      await runTransaction(firestore, async (transaction) => {
        const orderRef = doc(firestore, `companies/${companyId}/orders`, orderId);
        const oSnap = await transaction.get(orderRef);
        const pSnap = await transaction.get(productRef);
        if (!oSnap.exists()) throw new Error("Encomenda não encontrada.");
        const order = oSnap.data() as Order;
        if (order.status === 'Entregue') throw new Error("Esta encomenda já foi entregue.");
        if (!pSnap.exists()) throw new Error(`O produto "${order.productName}" não existe no inventário.`);
        const product = pSnap.data() as Product;
        const plan = planPartialDelivery(order, qty, product.stock || 0);
        if (!plan.ok) throw new Error(plan.error);
        const loc = order.location || (isMultiLocation ? locations[0]?.id : 'Principal');
        transaction.update(productRef, {
          stock: Math.max(0, (product.stock || 0) - qty),
          reservedStock: Math.max(0, (product.reservedStock || 0) - plan.releaseReserved),
          lastUpdated: new Date().toISOString(),
        });
        transaction.update(orderRef, {
          quantityDelivered: plan.quantityDelivered,
          quantityProduced: plan.quantityProduced,
          reservedQuantity: plan.reservedQuantity,
          deliveries: [...(order.deliveries || []), { date: new Date().toISOString(), quantity: qty, by: user.username || 'Sistema' }],
        });
        transaction.set(doc(collection(firestore, `companies/${companyId}/stockMovements`)), {
          productId: productRef.id,
          productName: order.productName,
          type: 'OUT',
          quantity: -qty,
          fromLocationId: loc,
          reason: `Levantamento parcial (Encomenda #${orderId.slice(-6).toUpperCase()}): ${qty} ${order.unit || 'un'}`,
          userId: user.id,
          userName: user.username,
          timestamp: serverTimestamp(),
        });
      });
      toast({ title: 'Levantamento registado', description: `${qty} ${orderPre.unit || 'un'} de ${orderPre.productName} saíram do stock.` });
      return true;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível registar', description: e.message });
      return false;
    }
  }, [firestore, companyId, user, toast, isReadOnly, isMultiLocation, locations, ordersData, assertOnline]);

  return { deleteOrder, finalizeOrder, deliverOrderPart };
}

export type OrderActions = ReturnType<typeof useOrderActions>;
