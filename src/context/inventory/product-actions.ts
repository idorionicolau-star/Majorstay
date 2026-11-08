'use client';

import { useCallback } from 'react';
import type { Product, StockMovement } from '@/lib/types';
import { collection, doc, writeBatch, getDocs, query, where, runTransaction, serverTimestamp, type CollectionReference, DocumentReference } from 'firebase/firestore';
import { computeSmartThresholds } from '@/lib/smart-thresholds';
import { formatCurrency, normalizeString } from '@/lib/utils';
import type { InventoryCore } from './core';
import { links } from '@/lib/deep-links';
import { locationIn, pickActive, sameLocation } from '@/lib/product-ref';

export function useProductActions(core: InventoryCore) {
  const { companyData, sendPush, locations, triggerEmailAlert, toast, isReadOnly, productsCollectionRef, firestore, user, companyId, productsData, addNotification, stockMovementsData, salesData, products, notifyManagers, assertOnline, isMultiLocation, catalogProductsData } = core;



  const checkStockAndNotify = useCallback(async (product: Product) => {
    const settings = companyData?.notificationSettings;
    const availableStock = product.stock - (product.reservedStock || 0);

    const isCritical = availableStock <= (product.criticalStockThreshold || 0);

    // If not critical, we stop
    if (!isCritical) {
      return;
    }

    sendPush({
      title: `⚠️ Stock crítico: ${product.name}`,
      body: `Restam ${availableStock} ${product.unit || 'un'} · ${locations.find(l => l.id === product.location)?.name || 'Principal'}`,
      link: links.product(product.name, product.location),
      tag: `critical-${product.name}`,
      type: 'stock',
      includeSelf: true, // alerta de stock não é "acção de outra pessoa": chega também a quem vendeu
      dedupeId: `critical-${product.name}-${product.location || ''}-${new Date().toISOString().slice(0, 10)}`,
    });

    // Handle legacy settings and new multi-email configuration
    let hasCriticalEmailConfigured = false;

    if (settings?.emails && Array.isArray(settings.emails)) {
      hasCriticalEmailConfigured = settings.emails.some(e => e.onCriticalStock && e.email.trim() !== '');
    } else if (settings?.email && settings.onCriticalStock) {
      hasCriticalEmailConfigured = settings.email.trim() !== '';
    }

    if (!hasCriticalEmailConfigured) {
      // Sem e-mail configurado: o alerta segue por notificação push (acima). Não incomodar com um aviso.
      return;
    }

    await triggerEmailAlert({
      type: 'CRITICAL',
      productName: product.name,
      quantity: availableStock,
      location: locations.find(l => l.id === product.location)?.name || 'Principal',
      threshold: product.criticalStockThreshold,
    });
  }, [companyData, locations, triggerEmailAlert, toast, sendPush]);


  const addProduct = useCallback(
    (newProductData: Omit<Product, 'id' | 'lastUpdated' | 'instanceId' | 'reservedStock' | 'sourceIds'>) => {
      if (isReadOnly) {
        toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
        return Promise.resolve();
      }
      if (!productsCollectionRef || !firestore || !user || !companyId) return Promise.resolve();

      const { name, location, stock: newStock } = newProductData;

      const processAdd = async () => {
        try {
          // 1. Move Robust Check and Query OUTSIDE the transaction
          let existingProductId: string | null = null;

          if (productsData) {
            const normalizedNewName = normalizeString(name);
            const targetLoc = location || "";
            const sameProduct = (p: Product) =>
              normalizeString(p.name) === normalizedNewName &&
              sameLocation(p.location, targetLoc);

            // Primeiro o produto activo; só depois um da lixeira (esse recomeça do zero, ver abaixo)
            const match = productsData.find(p => sameProduct(p) && !p.deletedAt) || productsData.find(sameProduct);
            if (match) {
              existingProductId = match.id || null;
            }
          }

          if (!existingProductId) {
            const q = query(productsCollectionRef, where("name", "==", name), where("location", "in", locationIn(location)));
            const querySnapshot = await getDocs(q);
            const found = pickActive(querySnapshot.docs) || querySnapshot.docs[0];
            if (found) {
              existingProductId = found.id;
            }
          }

          let finalProductId: string | null = null;

          await runTransaction(firestore, async (transaction) => {
            // 2. READ FIRST
            const docRef = existingProductId ? doc(productsCollectionRef as CollectionReference, existingProductId) : doc(productsCollectionRef as CollectionReference);
            const existingDocSnap = await transaction.get(docRef);
            const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);

            // 3. APPLY LOGIC AND WRITE LAST
            if (existingDocSnap.exists()) {
              finalProductId = docRef.id;
              const existingData = existingDocSnap.data() as Product;
              if (existingData.deletedAt) {
                // Estava na lixeira: volta a existir como produto NOVO. Antes herdava o stock e a reserva de quando
                // foi apagado (por isso "limpar o inventário" e voltar a registar fazia reaparecer os números antigos).
                transaction.set(docRef, {
                  ...newProductData,
                  stock: newStock,
                  reservedStock: 0,
                  lastUpdated: new Date().toISOString(),
                });
              } else {
                const oldStock = existingData.stock || 0;
                const updateData: Record<string, any> = { stock: oldStock + newStock, lastUpdated: new Date().toISOString() };
                // Preserve imageUrl if provided with the new product data
                if (newProductData.imageUrl) {
                  updateData.imageUrl = newProductData.imageUrl;
                }
                transaction.update(docRef, updateData);
              }
            } else {
              const newProduct: Omit<Product, 'id' | 'instanceId' | 'sourceIds'> = {
                ...newProductData,
                lastUpdated: new Date().toISOString(),
                reservedStock: 0,
              };
              transaction.set(docRef, newProduct);
              finalProductId = docRef.id;
            }

            const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
              productId: finalProductId!,
              productName: name,
              type: 'IN',
              quantity: newStock,
              toLocationId: location,
              reason: existingDocSnap.exists() && !(existingDocSnap.data() as Product).deletedAt ? `Entrada de novo lote (Match)` : `Criação de novo produto`,
              userId: user.id,
              userName: user.username,
            };
            const movementDocRef = doc(movementsRef as CollectionReference);
            transaction.set(movementDocRef, { ...movement, timestamp: serverTimestamp() });
          });


          addNotification({
            type: 'production',
            message: `Inventário atualizado para: ${name}`,
            href: '/inventory',
          });

        } catch (error) {
          console.error("Failed to add/update product:", error);
          toast({
            variant: "destructive",
            title: "Erro ao atualizar inventário",
            description: "Não foi possível guardar as alterações.",
          });
        }
      };

      return processAdd();
    },
    [productsCollectionRef, firestore, user, companyId, addNotification, toast]
  );


  const syncSmartThresholds = useCallback(async (mode: boolean | 'silent' = false) => {
    if (!firestore || !companyId || !productsData || !stockMovementsData) return;
    const isManual = mode === true; // só o botão mostra avisos
    const force = mode !== false;

    if (!force) {
      const lastSync = localStorage.getItem(`majorstockx_last_smart_sync_${companyId}`);
      if (lastSync) {
        const _1dayInMs = 1 * 24 * 60 * 60 * 1000;
        if (Date.now() - parseInt(lastSync, 10) < _1dayInMs) {
          return; // Skip if less than 1 day ago
        }
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);

    // Movimentos e vendas dos últimos 90 dias
    const recentMovements = stockMovementsData.filter(m => {
      if (m.type !== 'OUT') return false;
      const ts = m.timestamp;
      let moveDate: Date | null = null;
      if (ts) {
        if (typeof (ts as any).toDate === 'function') {
          moveDate = (ts as any).toDate();
        } else if (typeof (ts as any).seconds === 'number') {
          moveDate = new Date((ts as any).seconds * 1000);
        } else {
          moveDate = new Date(ts as any);
        }
      }

      // If we cannot parse it, keep it and let Python try its best
      if (!moveDate || isNaN(moveDate.getTime())) return true;
      return moveDate >= thirtyDaysAgo;
    });

    const recentSales = salesData?.filter(s => {
      const saleDate = new Date(s.date);
      return !isNaN(saleDate.getTime()) && saleDate >= thirtyDaysAgo;
    }) || [];

    try {
      // Cálculo local (sem servidor): antes chamava um script Python que o Vercel não corre.
      const predictions = computeSmartThresholds({
        products: productsData as any[],
        movements: recentMovements as any[],
        sales: recentSales as any[],
      });

      const batch = writeBatch(firestore);
      let updatesCount = 0;

      predictions.forEach((pred: any) => {
        const p = productsData.find(prod => prod.id === pred.id);
        if (!p || p.thresholdMode === 'manual') return;

        const hasSignificantChange =
          p.criticalStockThreshold !== pred.criticalStockThreshold ||
          p.lowStockThreshold !== pred.lowStockThreshold ||
          p.ads !== pred.ads ||
          p.targetStock !== pred.targetStock;

        if (hasSignificantChange && p.id) {
          batch.update(doc(firestore, 'companies', companyId, 'products', p.id), {
            criticalStockThreshold: pred.criticalStockThreshold,
            lowStockThreshold: pred.lowStockThreshold,
            ads: pred.ads,
            targetStock: pred.targetStock,
            lastUpdated: new Date().toISOString()
          });
          updatesCount++;
        }
      });

      if (updatesCount > 0) {
        await batch.commit();
        console.log(`Smart Thresholds updated via AI for ${updatesCount} products.`);
        if (isManual) {
          toast({ title: 'Sincronização Concluída', description: `${updatesCount} limites de stock foram atualizados pela IA v2.` });
        }
      } else if (isManual) {
        toast({ title: 'Sincronização Concluída', description: 'Os limites já estão otimizados.' });
      }
    } catch (error) {
      console.error("Falha ao rodar sincronização inteligente:", error);
      if (isManual) {
        toast({ variant: 'destructive', title: 'Erro na Sincronização', description: 'Não foi possível recalcular os limites neste momento.' });
      }
    }

    localStorage.setItem(`majorstockx_last_smart_sync_${companyId}`, Date.now().toString());
  }, [firestore, companyId, productsData, stockMovementsData, salesData, toast]);


  /** Põe vários produtos em limites automáticos e recalcula logo. */
  const setAutoThresholds = useCallback(async (list: Product[]) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || list.length === 0) return;
    // um produto juntado (vários locais/duplicados) tem vários documentos
    const ids = Array.from(new Set(list.flatMap(p => p.sourceIds?.length ? p.sourceIds : (p.id ? [p.id] : []))));
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(firestore);
      ids.slice(i, i + 400).forEach(id => batch.update(doc(firestore, 'companies', companyId, 'products', id), { thresholdMode: 'auto' }));
      await batch.commit();
    }
    toast({ title: 'Limites automáticos', description: `${list.length === 1 ? '1 produto passa' : `${list.length} produtos passam`} a ajustar o alerta baixo e crítico às vendas.` });
    // dá tempo ao snapshot de trazer o novo modo antes de recalcular
    setTimeout(() => { syncSmartThresholds('silent'); }, 3000);
  }, [isReadOnly, firestore, companyId, toast, syncSmartThresholds]);

  const updateProduct = useCallback(async (instanceId: string, updatedData: Partial<Product>) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!productsCollectionRef || !instanceId || !firestore) return;

    const productToUpdate = products.find(p => p.instanceId === instanceId);
    if (!productToUpdate || !productToUpdate.sourceIds) return;

    const batch = writeBatch(firestore);
    const { stock, ...restOfData } = updatedData;

    // Remove undefined values to prevent Firestore errors
    const safeData = Object.entries(restOfData).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    productToUpdate.sourceIds.forEach(id => {
      const docRef = doc(productsCollectionRef, id);
      batch.update(docRef, { ...safeData, lastUpdated: new Date().toISOString() });
    });

    const stockChanged = stock !== undefined && Math.abs(Number(stock) - (productToUpdate.stock || 0)) > 0.0001;
    if (stockChanged && user && companyId) {
      // Alteração de stock à mão também fica no histórico (e aparece em Perdas se for para menos).
      const delta = Number(stock) - (productToUpdate.stock || 0);
      batch.set(doc(collection(firestore, `companies/${companyId}/stockMovements`)), {
        productId: productToUpdate.sourceIds[0], productName: productToUpdate.name, type: 'ADJUSTMENT', quantity: delta,
        toLocationId: productToUpdate.location || '', reason: 'Stock alterado à mão (editar produto)',
        userId: user.id, userName: user.username, systemCountBefore: productToUpdate.stock || 0, physicalCount: Number(stock),
        timestamp: serverTimestamp(),
      });
    }

    if (stock !== undefined) {
      const firstDocRef = doc(productsCollectionRef as CollectionReference, productToUpdate.sourceIds[0]);
      batch.update(firstDocRef, { stock });

      for (let i = 1; i < productToUpdate.sourceIds.length; i++) {
        const otherDocRef = doc(productsCollectionRef as CollectionReference, productToUpdate.sourceIds[i]);
        batch.update(otherDocRef, { stock: 0, reservedStock: 0 });
      }
    }

    await batch.commit();

    if (stockChanged) {
      const delta = Number(stock) - (productToUpdate.stock || 0);
      notifyManagers({
        type: 'security',
        title: `✏️ Stock alterado à mão: ${productToUpdate.name}`,
        body: `${user?.username || '—'} mudou de ${productToUpdate.stock} para ${stock} ${productToUpdate.unit || 'un'} (${delta > 0 ? '+' : ''}${delta}) · ${formatCurrency(Math.abs(delta) * (productToUpdate.price || 0))}`,
        link: links.losses(productToUpdate.name),
      });
    }
    if (updatedData.price !== undefined && Math.abs(Number(updatedData.price) - (productToUpdate.price || 0)) >= 0.01) {
      notifyManagers({
        type: 'price',
        title: `💲 Preço alterado: ${productToUpdate.name}`,
        body: `${user?.username || '—'}: ${formatCurrency(productToUpdate.price || 0)} → ${formatCurrency(Number(updatedData.price))}`,
        link: links.product(productToUpdate.name, productToUpdate.location),
      });
    }

    // Trigger immediate AI sync if switched to 'auto' mode
    if (updatedData.thresholdMode === 'auto') {
      syncSmartThresholds(true);
    }

    const fullProduct = products.find(p => p.id === instanceId);
    if (fullProduct) {
      const productForNotification = { ...fullProduct, ...updatedData };
      checkStockAndNotify(productForNotification);
    }
  }, [productsCollectionRef, products, checkStockAndNotify, firestore, syncSmartThresholds, user, companyId, notifyManagers]);


  const deleteProduct = useCallback(async (instanceId: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!productsCollectionRef || !instanceId || !firestore || !user) return;
    const productToDelete = products.find(p => p.instanceId === instanceId);
    if (!productToDelete) return;

    const batch = writeBatch(firestore);

    const idsToDelete = productToDelete.sourceIds && productToDelete.sourceIds.length > 0
      ? productToDelete.sourceIds
      : [productToDelete.id || instanceId];

    idsToDelete.forEach(id => {
      if (id) {
        const docRef = doc(productsCollectionRef as CollectionReference, id);
        batch.update(docRef, {
          deletedAt: new Date().toISOString(),
          deletedBy: user.username
        });
      }
    });

    try {
      await batch.commit();
      toast({ title: 'Produto movido para a Lixeira', description: 'Pode restaurá-lo nas Definições.' });
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: 'Tente novamente.' });
    }
  }, [productsCollectionRef, products, firestore, user, toast]);


  const clearProductsCollection = useCallback(async () => {
    if (!productsCollectionRef || !firestore || !user) return;
    const batch = writeBatch(firestore);
    let count = 0;

    products.forEach(product => {
      const idsToDelete = product.sourceIds && product.sourceIds.length > 0
        ? product.sourceIds
        : [product.id || product.instanceId];

      idsToDelete.forEach(id => {
        if (id) {
          const docRef = doc(productsCollectionRef as CollectionReference, id);
          batch.update(docRef, {
            deletedAt: new Date().toISOString(),
            deletedBy: user.username
          });
          count++;
        }
      });
    });

    if (count === 0) return;

    try {
      await batch.commit();
      toast({
        title: "Inventário Limpo",
        description: `${count} produtos movidos para a lixeira.`,
      });
    } catch (error) {
      console.error("Error clearing inventory:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Limpar",
        description: "Não foi possível limpar o inventário.",
      });
    }
  }, [productsCollectionRef, products, firestore, user, toast]);


  const auditStock = useCallback(async (product: Product, physicalCount: number, reason: string) => {
    assertOnline('fazer a auditoria');
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }

    if (!firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro de conexão: Firestore não disponível.' });
      return;
    }
    if (!companyId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro de sessão: ID da empresa em falta.' });
      return;
    }
    if (!user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro de sessão: Utilizador não identificado.' });
      return;
    }
    if (!product.id) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Produto inválido: ID em falta.' });
      return;
    }

    const productRef = doc(firestore, `companies/${companyId}/products`, product.id);
    const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);
    // Produtos repetidos (mesmo nome e local) aparecem somados num só cartão: a contagem é do total, por isso
    // o stock todo fica no documento principal e os outros ficam a zero (antes ficavam por somar por cima).
    const otherRefs = (product.sourceIds || []).filter((id) => id !== product.id).map((id) => doc(firestore, `companies/${companyId}/products`, id));

    try {
      await runTransaction(firestore, async (transaction) => {
        // 1. READ FIRST
        const pSnap = await transaction.get(productRef);
        if (!pSnap.exists()) {
          throw new Error("Produto não encontrado na base de dados para auditoria.");
        }
        const freshData = pSnap.data() as Product;
        const others = (await Promise.all(otherRefs.map((r) => transaction.get(r)))).filter((s) => s.exists());
        const currentSystemStock = (freshData.stock || 0) + others.reduce((t, s) => t + ((s.data() as Product).stock || 0), 0);
        const realAdjustment = physicalCount - currentSystemStock;

        // 2. WRITE LAST
        transaction.update(productRef, { stock: physicalCount, lastUpdated: new Date().toISOString() });
        others.forEach((s) => transaction.update(s.ref, { stock: 0, lastUpdated: new Date().toISOString() }));

        const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
          productId: product.id!,
          productName: product.name,
          type: 'ADJUSTMENT',
          quantity: realAdjustment,
          toLocationId: product.location,
          reason: reason,
          userId: user.id,
          userName: user.username,
          isAudit: true,
          systemCountBefore: currentSystemStock,
          physicalCount: physicalCount,
        };
        transaction.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });

        // Use fresh data for post-transaction logic
        checkStockAndNotify({ ...freshData, stock: physicalCount });
      });

      toast({ title: 'Auditoria Concluída', description: `O stock de ${product.name} foi ajustado.` });
      if (physicalCount < (product.stock || 0)) {
        const missing = (product.stock || 0) - physicalCount;
        notifyManagers({
          type: 'security', always: true,
          title: `🔎 Contagem: ${product.name} com falta de ${missing} ${product.unit || 'un'}`,
          body: `${user.username} · ${formatCurrency(missing * (product.price || 0))} · ${reason}`,
          link: links.losses(product.name),
        });
      }

    } catch (error) {
      console.error('Audit transaction failed: ', error);
      toast({ variant: 'destructive', title: 'Erro na Auditoria', description: (error as Error).message });
    }

  }, [firestore, companyId, user, toast, checkStockAndNotify, notifyManagers]);


  /**
   * Transfere `quantity` (do disponível) de uma localização para outra, numa transacção. Devolve se correu bem.
   * `silent`: sem avisos (a página de transferência faz vários de seguida e mostra um resumo; o erro vem em `error`).
   */
  const transferStock = useCallback(async (productName: string, fromLocationId: string, toLocationId: string, quantity: number, opts: { silent?: boolean } = {}): Promise<{ ok: boolean; error?: string }> => {
    const fail = (title: string, description: string) => {
      if (!opts.silent) toast({ variant: 'destructive', title, description });
      return { ok: false, error: description };
    };
    assertOnline('transferir stock');
    if (isReadOnly) return fail("Conta em modo leitura", "Modo leitura activo — contacte o suporte para reactivar o acesso completo.");
    if (!firestore || !companyId || !user) return { ok: false, error: 'Sessão não carregada.' };

    const fromProduct = products.find(p => p.name === productName && sameLocation(p.location, fromLocationId));
    if (!fromProduct || !fromProduct.id) return fail('Erro', 'Produto de origem não encontrado.');
    if (fromProduct.stock - fromProduct.reservedStock < quantity) return fail('Stock Insuficiente', `Disponível: ${fromProduct.stock - fromProduct.reservedStock}`);

    const toProduct = products.find(p => p.name === productName && sameLocation(p.location, toLocationId));

    try {
      await runTransaction(firestore, async (transaction) => {
        const productsRef = collection(firestore, `companies/${companyId}/products`);
        const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);

        const fromDocRef = doc(productsRef, fromProduct.id!);
        const toDocRef = toProduct?.id ? doc(productsRef, toProduct.id) : doc(productsRef);

        // 1. READ ALL FIRST
        const fromSnap = await transaction.get(fromDocRef);
        const toSnap = toProduct?.id ? await transaction.get(toDocRef) : null;

        if (!fromSnap.exists()) {
          throw new Error("Produto de origem não encontrado na base de dados.");
        }

        const freshFromData = fromSnap.data() as Product;
        const freshToData = toSnap?.exists() ? toSnap.data() as Product : null;

        // 2. VALIDATE AND CALCULATE
        // Só se transfere o disponível (stock − reservado): a verificação de fora usa isto, a de dentro (com os dados
        // frescos) usava só o stock e deixava duas pessoas transferirem material já reservado para clientes.
        const availableNow = (freshFromData.stock || 0) - (freshFromData.reservedStock || 0);
        if (availableNow < quantity) {
          throw new Error(`Stock insuficiente em ${fromLocationId}. Disponível: ${Math.max(0, availableNow)}`);
        }

        const newFromStock = freshFromData.stock - quantity;

        // 3. WRITE ALL LAST
        transaction.update(fromDocRef, { stock: newFromStock, lastUpdated: new Date().toISOString() });

        if (freshToData) {
          transaction.update(toDocRef, { stock: (freshToData.stock || 0) + quantity, lastUpdated: new Date().toISOString() });
        } else {
          const { id, instanceId, stock, reservedStock, location: _, lastUpdated: __, ...restOfProduct } = freshFromData;
          transaction.set(toDocRef, {
            ...restOfProduct,
            location: toLocationId,
            stock: quantity,
            reservedStock: 0,
            lastUpdated: new Date().toISOString()
          });
        }

        const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
          productId: fromProduct.id!,
          productName,
          type: 'TRANSFER',
          quantity,
          fromLocationId,
          toLocationId,
          reason: `Transferência manual`,
          userId: user.id,
          userName: user.username,
        };
        transaction.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });

        // Side effect post-transaction logic
        checkStockAndNotify({ ...freshFromData, stock: newFromStock });
      });


      if (!opts.silent) toast({ title: 'Transferência Concluída' });
      return { ok: true };
    } catch (error) {
      console.error('Error transferring stock:', error);
      return fail('Erro na Transferência', (error as Error).message);
    }
  }, [firestore, companyId, user, products, toast, checkStockAndNotify]);






  const updateProductStock = useCallback(async (productName: string, quantity: number, locationId?: string) => {
    assertOnline('actualizar o stock');
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !user) return;
    const targetLocation = locationId || (isMultiLocation && locations.length > 0 ? locations[0].id : 'Principal');
    const catalogProduct = catalogProductsData?.find(p => p.name === productName);
    const existingInstance = products.find(p => p.name === productName && sameLocation(p.location, targetLocation));

    const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);

    try {
      await runTransaction(firestore, async (transaction) => {
        let docRef: DocumentReference;
        let freshData: Product | null = null;
        const productsRef = collection(firestore, `companies/${companyId}/products`);

        if (existingInstance && existingInstance.id) {
          docRef = doc(productsRef, existingInstance.id);
          const pSnap = await transaction.get(docRef);
          if (pSnap.exists()) {
            freshData = pSnap.data() as Product;
          }
        } else {
          docRef = doc(productsRef);
        }

        if (freshData) {
          const newStock = (freshData.stock || 0) + quantity;
          transaction.update(docRef, { stock: newStock, lastUpdated: new Date().toISOString() });
          checkStockAndNotify({ ...freshData, stock: newStock });
        } else {
          let productDataToUse: any = {};
          if (catalogProduct) {
            const { id, priceHistory, ...rest } = catalogProduct; // o histórico de preços fica no catálogo
            productDataToUse = rest;
          } else {
            const blueprint = products.find(p => p.name === productName);
            if (blueprint) {
              const { id, instanceId, stock, reservedStock, location, lastUpdated, ...rest } = blueprint;
              productDataToUse = rest;
            } else {
              productDataToUse = { name: productName, category: 'Geral', price: 0, unit: 'un', lowStockThreshold: 5, criticalStockThreshold: 2 };
            }
          }

          transaction.set(docRef, {
            ...productDataToUse,
            stock: quantity,
            reservedStock: 0,
            location: targetLocation,
            lastUpdated: new Date().toISOString()
          });
        }

        const movement: Omit<StockMovement, 'id' | 'timestamp'> = {
          productId: docRef.id,
          productName,
          type: 'IN',
          quantity,
          toLocationId: targetLocation,
          reason: freshData ? `Produção de Lote: ${quantity} unidades` : `Início de Produção: ${quantity} unidades`,
          userId: user.id,
          userName: user.username,
        };
        transaction.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });
      });
    } catch (e: any) {
      console.error("Error updating product stock:", e);
      toast({ variant: 'destructive', title: 'Erro ao Atualizar Stock', description: e.message });
    }


    addNotification({
      type: 'production',
      message: `${quantity} unidades de ${productName} foram produzidas.`,
      href: '/production',
    });
  }, [firestore, companyId, products, catalogProductsData, isMultiLocation, locations, toast, user, checkStockAndNotify, addNotification]);
  return { checkStockAndNotify, addProduct, syncSmartThresholds, setAutoThresholds, updateProduct, deleteProduct, clearProductsCollection, auditStock, transferStock, updateProductStock };
}

export type ProductActions = ReturnType<typeof useProductActions>;
