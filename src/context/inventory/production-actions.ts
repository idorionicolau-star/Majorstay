'use client';

import { useCallback } from 'react';
import { cleanMaterials, materialDelta, recipeMaterials, todayMz, validProductionDate } from '@/lib/production-core';
import type { Product, Production, ProductionEdit, ProductionLog, StockMovement, RawMaterial } from '@/lib/types';
import { collection, doc, getDocs, query, where, runTransaction, getDoc, serverTimestamp, arrayUnion, DocumentReference, limit } from 'firebase/firestore';
import { ref } from "firebase/storage";
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { InventoryCore } from './core';
import { locationIn, pickActive, resolveInventoryProductRef, sameLocation } from '@/lib/product-ref';
import { ingredientRequiredQty } from '@/lib/order-stock';
import { applyMaterialUse, assertMaterialEnough, findRecipe, productionMaterials, readMaterialLines, readMaterialUse } from '@/lib/production-materials';
import { isProductionInStock } from '@/lib/production';

export function useProductionActions(core: InventoryCore) {
  const { assertOnline, isReadOnly, toast, firestore, companyId, user, isMultiLocation, locations, recipesData, catalogProductsData, addNotification, productsData, ordersData, productionsCollectionRef, productionsData, rawMaterialsData } = core;


  /**
   * Regista uma produção: o produto entra no stock e a matéria-prima da receita é descontada, numa transacção.
   * `date` (AAAA-MM-DD): o dia em que foi produzida (ex.: ontem); por defeito, hoje. `silent`: sem avisos nem
   * notificação (a página de produção regista vários de seguida e mostra um resumo). Erros são lançados.
   */
  const addProduction = useCallback(async (prodData: Omit<Production, 'id' | 'date' | 'registeredBy' | 'status'> & { date?: string }, opts: { silent?: boolean } = {}) => {
    assertOnline('registar a produção');
    if (isReadOnly) {
      if (!opts.silent) toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      throw new Error('Conta em modo leitura.');
    }
    if (!firestore || !companyId || !user) throw new Error("Contexto não pronto.");

    const { productName, quantity, location, orderId, unit } = prodData;
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      const description = 'A quantidade produzida tem de ser maior que zero.';
      if (!opts.silent) toast({ variant: 'destructive', title: 'Quantidade inválida', description });
      throw new Error(description);
    }
    const today = todayMz(); // dia de Maputo (à meia-noite e meia já é o dia seguinte, não o de UTC)
    const prodDate = prodData.date && /^\d{4}-\d{2}-\d{2}$/.test(prodData.date) && prodData.date <= today ? prodData.date : today;
    const targetLocation = location || (isMultiLocation && locations.length > 0 ? locations[0].id : 'Principal');

    // 1. Move product lookup OUTSIDE the transaction because transactions don't support queries
    const productsRef = collection(firestore, `companies/${companyId}/products`);
    const q = query(productsRef, where("name", "==", productName), where("location", "in", locationIn(targetLocation)));
    const productQuerySnapshot = await getDocs(q);
    const existingProductId = pickActive(productQuerySnapshot.docs)?.id ?? null; // um produto na lixeira não recebe stock

    try {
      await runTransaction(firestore, async (transaction) => {
        // --- ALL READS MUST COME FIRST ---

        // 2. Prepare Product Reference and Read
        const productDocRef = existingProductId ? doc(productsRef, existingProductId) : doc(productsRef);
        const pDoc = await transaction.get(productDocRef);

        // 3. Matéria-prima: a que foi indicada (pode diferir da receita: sacos a mais, outro material) ou a da receita
        const materialLines = Array.isArray(prodData.materialsUsed)
          ? cleanMaterials(prodData.materialsUsed)
          : recipeMaterials(findRecipe(recipesData ?? undefined, productName), quantity, rawMaterialsData || []);
        const materialUses = await readMaterialLines(transaction, firestore, companyId, materialLines);

        // 4. Recusa se faltar matéria-prima
        assertMaterialEnough(materialUses);

        // --- ALL WRITES MUST COME LAST ---

        // 5. Desconta a matéria-prima
        applyMaterialUse(transaction, materialUses, -1);

        // 6. Update/Create Product Stock
        if (pDoc.exists()) {
          const pData = pDoc.data() as Product;
          transaction.update(productDocRef, {
            stock: (pData.stock || 0) + quantity,
            lastUpdated: new Date().toISOString()
          });
        } else {
          const catalogProduct = catalogProductsData?.find(p => p.name === productName);
          const newProductData = {
            name: productName,
            category: catalogProduct?.category || 'Geral',
            stock: quantity,
            reservedStock: 0,
            price: catalogProduct?.price || 0,
            location: targetLocation,
            lastUpdated: new Date().toISOString(),
            unit: unit || catalogProduct?.unit || 'un',
            lowStockThreshold: catalogProduct?.lowStockThreshold || 10,
            criticalStockThreshold: catalogProduct?.criticalStockThreshold || 5,
          };
          transaction.set(productDocRef, newProductData);
        }

        // 7. Create Production Record
        const newProduction: any = {
          date: prodDate,
          productName: productName || 'Produto Desconhecido',
          quantity: Number(quantity) || 0,
          unit: unit || 'un',
          registeredBy: user.username || 'Desconhecido',
          status: 'Transferido', // já entrou no stock nesta mesma transacção
          location: targetLocation || 'Principal',
          // o que foi realmente gasto: apagar ou editar depois devolve exactamente isto
          materialsUsed: materialLines,
          ...(prodData.notes && prodData.notes.trim() ? { notes: prodData.notes.trim().slice(0, 1000) } : {}),
        };

        // Explicitly include orderId ONLY if it has a valid string value
        if (orderId && typeof orderId === 'string' && orderId.trim() !== '' && orderId !== 'undefined') {
          newProduction.orderId = orderId;
        }

        const productionsRef = collection(firestore, `companies/${companyId}/productions`);
        transaction.set(doc(productionsRef), newProduction);

        // 8. Create Stock Movement Log
        const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);
        const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
          productId: productDocRef.id,
          productName,
          type: 'IN',
          quantity,
          toLocationId: targetLocation,
          reason: `Produção: ${quantity} ${unit || 'un'}${prodDate !== today ? ` (produzido a ${prodDate.split('-').reverse().join('/')})` : ''}`,
          userId: user.id,
          userName: user.username,
        };
        transaction.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });

      }); // End Transaction


      if (!opts.silent) addNotification({
        type: 'production',
        message: `Produção de ${quantity} ${unit || 'un'} de ${productName} registada e stock atualizado.`,
        href: '/production',
      });

    } catch (e: any) {
      console.error("Production error:", e);
      if (!opts.silent) toast({ variant: 'destructive', title: 'Erro na Produção', description: e.message });
      throw e; // Re-throw so the dialog knows to stay open or handle error
    }
  }, [firestore, companyId, user, addNotification, recipesData, rawMaterialsData, productsData, catalogProductsData, isMultiLocation, locations, toast]);


  const addProductionLog = useCallback(async (orderId: string, logData: { quantity: number; notes?: string }) => {
    assertOnline('registar a produção');
    if (!firestore || !companyId || !user || !ordersData) return;

    const orderToUpdate = ordersData.find(o => o.id === orderId);
    if (!orderToUpdate) return;
    if (!Number.isFinite(Number(logData.quantity)) || Number(logData.quantity) <= 0) {
      toast({ variant: 'destructive', title: 'Quantidade inválida', description: 'A quantidade produzida tem de ser maior que zero.' });
      return;
    }

    try {
      const orderDocRef = doc(firestore, `companies/${companyId}/orders`, orderId);
      const productionsRef = collection(firestore, `companies/${companyId}/productions`);
      const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);

      // O productId pode ser o ID do inventário, o do catálogo ou o nome: resolve o produto do inventário
      const logLocation = orderToUpdate.location || (isMultiLocation ? locations[0]?.id : 'Principal');
      const resolvedProductRef = await resolveInventoryProductRef(firestore, companyId, {
        productId: orderToUpdate.productId,
        productName: orderToUpdate.productName,
        location: logLocation || 'Principal',
      });
      const newProductRef = resolvedProductRef ? null : doc(collection(firestore, `companies/${companyId}/products`));
      const recipe = findRecipe(recipesData ?? undefined, orderToUpdate.productName);

      await runTransaction(firestore, async (transaction) => {
        // --- READS ---
        let productData: Product | null = null;
        if (resolvedProductRef) {
          const pDoc = await transaction.get(resolvedProductRef);
          if (pDoc.exists()) {
            productData = pDoc.data() as Product;
          }
        }

        // Matéria-prima da receita (igual à Produção normal): lê tudo antes de escrever e recusa se faltar
        const ingredientDocs: { ref: DocumentReference; data: RawMaterial; requiredQty: number }[] = [];
        for (const ingredient of recipe?.ingredients || []) {
          const materialRef = doc(firestore, `companies/${companyId}/rawMaterials`, ingredient.rawMaterialId);
          const materialDoc = await transaction.get(materialRef);
          if (!materialDoc.exists()) {
            throw new Error(`Matéria-prima não encontrada (ID: ${ingredient.rawMaterialId}) para a receita de ${orderToUpdate.productName}.`);
          }
          ingredientDocs.push({ ref: materialRef, data: materialDoc.data() as RawMaterial, requiredQty: ingredientRequiredQty(ingredient, logData.quantity) });
        }
        for (const ing of ingredientDocs) {
          if ((ing.data.stock || 0) < ing.requiredQty) {
            throw new Error(`Stock insuficiente de ${ing.data.name}. Necessário: ${ing.requiredQty}, Disponível: ${ing.data.stock}.`);
          }
        }

        // --- WRITES ---
        for (const ing of ingredientDocs) {
          transaction.update(ing.ref, { stock: (ing.data.stock || 0) - ing.requiredQty });
        }
        const newLog: ProductionLog = {
          id: `log-${Date.now()}`,
          date: new Date().toISOString(),
          quantity: logData.quantity,
          notes: logData.notes,
          registeredBy: user.username || 'Desconhecido',
        };
        const newQuantityProduced = orderToUpdate.quantityProduced + logData.quantity;

        transaction.update(orderDocRef, {
          quantityProduced: newQuantityProduced,
          productionLogs: arrayUnion(newLog)
        });

        const newProduction: Omit<Production, 'id'> = {
          date: new Date().toISOString().split('T')[0],
          productName: orderToUpdate.productName,
          quantity: logData.quantity,
          unit: orderToUpdate.unit,
          location: orderToUpdate.location,
          registeredBy: user.username || 'Desconhecido',
          status: 'Concluído',
          orderId: orderId,
          materialsUsed: ingredientDocs.map((g) => ({ rawMaterialId: g.ref.id, name: g.data.name, quantity: g.requiredQty, unit: g.data.unit })),
          ...(logData.notes && logData.notes.trim() ? { notes: logData.notes.trim().slice(0, 1000) } : {}),
        };
        transaction.set(doc(productionsRef), newProduction);

        // Soma ao stock físico e regista o movimento. Se o produto ainda não existe no inventário, nasce já com esta produção.
        const targetProductRef = resolvedProductRef && productData ? resolvedProductRef : newProductRef;
        if (targetProductRef) {
          if (resolvedProductRef && productData) {
            transaction.update(resolvedProductRef, {
              stock: (productData.stock || 0) + logData.quantity,
              lastUpdated: new Date().toISOString()
            });
          } else {
            const cp = catalogProductsData?.find(p => p.name === orderToUpdate.productName);
            transaction.set(targetProductRef, {
              name: orderToUpdate.productName,
              category: cp?.category || 'Geral',
              stock: logData.quantity,
              reservedStock: 0,
              price: cp?.price || orderToUpdate.unitPrice || 0,
              unit: orderToUpdate.unit || cp?.unit || 'un',
              location: logLocation || 'Principal',
              lowStockThreshold: cp?.lowStockThreshold || 10,
              criticalStockThreshold: cp?.criticalStockThreshold || 5,
              ...(cp?.imageUrl ? { imageUrl: cp.imageUrl } : {}),
              lastUpdated: new Date().toISOString(),
            });
          }

          const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
            productId: targetProductRef.id,
            productName: orderToUpdate.productName,
            type: 'IN',
            quantity: logData.quantity,
            toLocationId: orderToUpdate.location,
            reason: `Produção Parcial (Encomenda #${orderId.slice(-6).toUpperCase()}): ${logData.quantity} ${orderToUpdate.unit || 'un'}`,
            userId: user.id,
            userName: user.username,
          };
          transaction.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });
        }
      });

      toast({
        title: "Registo de Produção Adicionado",
        description: `${logData.quantity} unidades de "${orderToUpdate.productName}" foram produzidas e adicionadas ao stock.`,
      });
      addNotification({
        type: 'production',
        message: `Produção de ${orderToUpdate.productName} atualizada.`,
        href: `/orders?id=${orderId}`
      });

    } catch (error: any) {
      console.error("Error adding production log: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao Registar",
        description: error.message || "Não foi possível guardar o registo de produção.",
      });
    }
  }, [firestore, companyId, user, ordersData, toast, addNotification, isMultiLocation, locations, recipesData, catalogProductsData]);


  /**
   * Apagar (ou restaurar) um registo de produção que já entrou no stock desfaz (ou refaz) o que ele fez:
   * o produto sai do stock, a matéria-prima volta, e a encomenda perde a parte "produzida".
   * Numa encomenda já entregue o stock já seguiu para o cliente: só se apaga o registo.
   */
  const reverseProduction = useCallback(async (productionId: string, direction: 'undo' | 'redo') => {
    if (!firestore || !companyId || !user || !productionsCollectionRef) return;
    const prodRef = doc(productionsCollectionRef, productionId);
    const prodSnap = await getDoc(prodRef);
    if (!prodSnap.exists()) return;
    const prod = prodSnap.data() as Production;
    const undo = direction === 'undo';
    const stamp = undo ? { deletedAt: new Date().toISOString() } : { deletedAt: null as unknown as string };

    const order = prod.orderId ? ordersData?.find(o => o.id === prod.orderId) : undefined;
    if (!isProductionInStock(prod) || order?.status === 'Entregue') {
      await updateDocumentNonBlocking(prodRef, stamp);
      return;
    }

    const location = prod.location || (isMultiLocation ? locations[0]?.id : 'Principal') || 'Principal';
    const productRef = await resolveInventoryProductRef(firestore, companyId, { productName: prod.productName, location });
    if (!productRef) throw new Error(`O produto "${prod.productName}" já não existe no inventário: não dá para ${undo ? 'desfazer' : 'refazer'} esta produção.`);

    await runTransaction(firestore, async (transaction) => {
      const pSnap = await transaction.get(productRef);
      if (!pSnap.exists()) throw new Error(`O produto "${prod.productName}" já não existe no inventário.`);
      const p = pSnap.data() as Product;
      const orderRef = prod.orderId && order ? doc(firestore, `companies/${companyId}/orders`, prod.orderId) : null;
      const oSnap = orderRef ? await transaction.get(orderRef) : null;
      // a matéria-prima que esta produção gastou (a registada; nas antigas, a da receita)
      const materials = await readMaterialLines(transaction, firestore, companyId, productionMaterials(prod, recipesData ?? undefined, rawMaterialsData || []));

      if (undo && (p.stock || 0) < prod.quantity) {
        throw new Error(`Não dá para apagar: o stock atual de ${prod.productName} (${p.stock || 0}) é menor do que o que esta produção acrescentou (${prod.quantity}). Já foi vendido ou movido.`);
      }
      if (!undo) assertMaterialEnough(materials);

      transaction.update(productRef, { stock: Math.max(0, (p.stock || 0) + (undo ? -prod.quantity : prod.quantity)), lastUpdated: new Date().toISOString() });
      applyMaterialUse(transaction, materials, undo ? 1 : -1);
      if (orderRef && oSnap?.exists()) {
        const produced = Number(oSnap.data().quantityProduced) || 0;
        transaction.update(orderRef, { quantityProduced: Math.max(0, produced + (undo ? -prod.quantity : prod.quantity)) });
      }
      transaction.update(prodRef, stamp);
      transaction.set(doc(collection(firestore, `companies/${companyId}/stockMovements`)), {
        productId: productRef.id,
        productName: prod.productName,
        type: undo ? 'OUT' : 'IN',
        quantity: undo ? -prod.quantity : prod.quantity,
        ...(undo ? { fromLocationId: location } : { toLocationId: location }),
        reason: undo ? `Produção apagada: ${prod.quantity} ${prod.unit || 'un'}` : `Produção restaurada: ${prod.quantity} ${prod.unit || 'un'}`,
        userId: user.id,
        userName: user.username,
        timestamp: serverTimestamp(),
      });
    });
  }, [firestore, companyId, user, productionsCollectionRef, ordersData, isMultiLocation, locations, recipesData, rawMaterialsData]);

  const deleteProduction = useCallback(async (productionId: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    try {
      await reverseProduction(productionId, 'undo');
      toast({ title: 'Registo de Produção movido para Lixeira', description: 'O stock e a matéria-prima foram acertados.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível apagar', description: e?.message });
    }
  }, [isReadOnly, toast, reverseProduction]);

  const restoreProduction = useCallback(async (productionId: string) => {
    try {
      await reverseProduction(productionId, 'redo');
      toast({ title: 'Produção restaurada', description: 'O stock e a matéria-prima foram refeitos.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível restaurar', description: e?.message });
    }
  }, [toast, reverseProduction]);


  const updateProduction = useCallback((productionId: string, data: Partial<Production>) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!productionsCollectionRef) return;
    const docRef = doc(productionsCollectionRef, productionId);
    updateDocumentNonBlocking(docRef, data);
    toast({ title: 'Registo de Produção Atualizado' });
  }, [productionsCollectionRef, toast]);
  /**
   * Edita tudo numa produção já registada (produto, quantidade, data, local, notas, matéria-prima usada) e acerta o
   * stock pela diferença, numa transacção: o produto antigo perde o que esta produção lhe deu e o novo ganha a nova
   * quantidade; cada matéria-prima volta ou sai conforme o que mudou. Recusa se o stock já não chegar (já vendido).
   * Produção de encomenda: o produto e o local não mudam (a encomenda é desse produto).
   */
  const editProduction = useCallback(async (productionId: string, data: ProductionEdit) => {
    assertOnline('editar a produção');
    if (isReadOnly) throw new Error('Conta em modo leitura.');
    if (!firestore || !companyId || !user || !productionsCollectionRef) throw new Error('Contexto não pronto.');
    const qty = Number(data.quantity);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('A quantidade tem de ser maior que zero.');
    if (!validProductionDate(data.date)) throw new Error('Escolha um dia até hoje (no máximo um ano atrás).');
    const productName = (data.productName || '').trim();
    if (!productName) throw new Error('Escolha o produto.');

    const prodRef = doc(productionsCollectionRef, productionId);
    const prodSnap = await getDoc(prodRef);
    if (!prodSnap.exists()) throw new Error('Esta produção já não existe.');
    const prod = prodSnap.data() as Production;
    const defaultLoc = (isMultiLocation ? locations[0]?.id : 'Principal') || 'Principal';
    const oldLoc = prod.location || defaultLoc;
    const newLoc = (isMultiLocation ? data.location : undefined) || oldLoc;
    if (prod.orderId && (productName !== prod.productName || !sameLocation(oldLoc, newLoc))) {
      throw new Error('Esta produção é de uma encomenda: o produto e o local não podem mudar (apague-a e registe de novo, se preciso).');
    }
    const newLines = cleanMaterials(data.materialsUsed || []);
    const oldLines = productionMaterials(prod, recipesData ?? undefined, rawMaterialsData || []);
    const unit = data.unit || prod.unit || 'un';
    const notes = (data.notes || '').trim().slice(0, 1000);
    const fields = { productName, quantity: qty, unit, date: data.date, location: newLoc, notes, materialsUsed: newLines };

    const order = prod.orderId ? ordersData?.find(o => o.id === prod.orderId) : undefined;
    // não entrou no stock (registo antigo) ou a encomenda já foi entregue: só o registo muda
    if (!isProductionInStock(prod) || order?.status === 'Entregue') {
      await updateDocumentNonBlocking(prodRef, fields);
      return;
    }

    const oldRef = await resolveInventoryProductRef(firestore, companyId, { productName: prod.productName, location: oldLoc });
    if (!oldRef) throw new Error(`O produto "${prod.productName}" já não existe no inventário: não dá para corrigir esta produção.`);
    const sameProduct = productName === prod.productName && sameLocation(oldLoc, newLoc);
    const productsRef = collection(firestore, `companies/${companyId}/products`);
    const foundNew = sameProduct ? oldRef : await resolveInventoryProductRef(firestore, companyId, { productName, location: newLoc });
    const newRef = foundNew || doc(productsRef);
    const delta = materialDelta(oldLines, newLines);
    const nameOf = new Map([...oldLines, ...newLines].map((l) => [l.rawMaterialId, l.name]));
    const now = new Date().toISOString();

    await runTransaction(firestore, async (transaction) => {
      // --- LER ---
      const oldSnap = await transaction.get(oldRef);
      if (!oldSnap.exists()) throw new Error(`O produto "${prod.productName}" já não existe no inventário.`);
      const newSnap = !sameProduct && foundNew ? await transaction.get(newRef) : null;
      const orderRef = prod.orderId && order ? doc(firestore, `companies/${companyId}/orders`, prod.orderId) : null;
      const oSnap = orderRef ? await transaction.get(orderRef) : null;
      const mats: { ref: DocumentReference; stock: number; d: number; name: string }[] = [];
      for (const [id, d] of delta) {
        const ref = doc(firestore, `companies/${companyId}/rawMaterials`, id);
        const snap = await transaction.get(ref);
        if (!snap.exists()) {
          if (d > 0) continue; // devolver a uma matéria-prima apagada: nada a fazer
          throw new Error(`A matéria-prima "${nameOf.get(id) || id}" já não existe.`);
        }
        mats.push({ ref, stock: Number(snap.get('stock')) || 0, d, name: snap.get('name') || nameOf.get(id) || id });
      }

      // --- VALIDAR ---
      const oldStock = Number(oldSnap.get('stock')) || 0;
      if (sameProduct) {
        if (oldStock + (qty - prod.quantity) < 0) throw new Error(`Não dá para baixar para ${qty}: o stock atual de ${prod.productName} (${oldStock}) já não chega — parte já foi vendida ou movida.`);
      } else if (oldStock < prod.quantity) {
        throw new Error(`Não dá para mudar o produto: o stock atual de ${prod.productName} (${oldStock}) é menor do que esta produção lhe deu (${prod.quantity}).`);
      }
      for (const m of mats) if (m.stock + m.d < 0) throw new Error(`Stock insuficiente de ${m.name}. Precisa de mais ${-m.d}, há ${m.stock}.`);

      // --- ESCREVER ---
      const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);
      const move = (productId: string, name: string, q: number, loc: string, reason: string) => transaction.set(doc(movementsRef), {
        productId, productName: name, type: q >= 0 ? 'IN' : 'OUT', quantity: q,
        ...(q >= 0 ? { toLocationId: loc } : { fromLocationId: loc }),
        reason, userId: user.id, userName: user.username, timestamp: serverTimestamp(),
      });
      if (sameProduct) {
        const dq = qty - prod.quantity;
        if (dq !== 0) {
          transaction.update(oldRef, { stock: oldStock + dq, lastUpdated: now });
          move(oldRef.id, productName, dq, newLoc, `Produção corrigida: ${prod.quantity} → ${qty} ${unit}`);
        }
      } else {
        transaction.update(oldRef, { stock: oldStock - prod.quantity, lastUpdated: now });
        move(oldRef.id, prod.productName, -prod.quantity, oldLoc, `Produção corrigida: passou para ${productName}`);
        if (newSnap?.exists()) {
          transaction.update(newRef, { stock: (Number(newSnap.get('stock')) || 0) + qty, lastUpdated: now });
        } else {
          const cp = catalogProductsData?.find(p => p.name === productName);
          transaction.set(newRef, {
            name: productName, category: cp?.category || 'Geral', stock: qty, reservedStock: 0, price: cp?.price || 0,
            location: newLoc, lastUpdated: now, unit: unit || cp?.unit || 'un',
            lowStockThreshold: cp?.lowStockThreshold || 10, criticalStockThreshold: cp?.criticalStockThreshold || 5,
            ...(cp?.variantGroup ? { variantGroup: cp.variantGroup, variantValues: cp.variantValues || {} } : {}),
          });
        }
        move(newRef.id, productName, qty, newLoc, `Produção corrigida: era ${prod.productName}`);
      }
      for (const m of mats) transaction.update(m.ref, { stock: Math.max(0, m.stock + m.d) });
      if (orderRef && oSnap?.exists() && qty !== prod.quantity) {
        transaction.update(orderRef, { quantityProduced: Math.max(0, (Number(oSnap.get('quantityProduced')) || 0) + qty - prod.quantity) });
      }
      transaction.update(prodRef, { ...fields, editedAt: now, editedBy: user.username || user.id });
    });
  }, [assertOnline, isReadOnly, firestore, companyId, user, productionsCollectionRef, isMultiLocation, locations, recipesData, rawMaterialsData, ordersData, catalogProductsData]);

  return { addProduction, addProductionLog, deleteProduction, restoreProduction, updateProduction, editProduction };
}

export type ProductionActions = ReturnType<typeof useProductionActions>;
