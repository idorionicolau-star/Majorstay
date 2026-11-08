'use client';

import { useCallback, useMemo } from 'react';
import type { Order, Product, RawMaterial, Recipe, Sale } from '@/lib/types';
import { collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp, writeBatch, updateDoc, deleteDoc, setDoc, arrayUnion, type CollectionReference, arrayRemove } from 'firebase/firestore';
import { resolveInventoryProductRef } from '@/lib/product-ref';
import { reservedToRelease } from '@/lib/order-stock';
import { updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { InventoryCore } from './core';
import { planMergeIntoVariant, planRename, renameClash, renamePairs } from '@/lib/rename';
import { nameKey } from '@/lib/catalog-view';

type CatalogProduct = Omit<
  Product,
  'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'
>;
type CatalogCategory = { id: string; name: string };

export function useSettingsActions(core: InventoryCore) {
  const { isReadOnly, user, isMultiLocation, locations, toast, catalogProductsCollectionRef, catalogCategoriesCollectionRef, catalogCategoriesData, rawMaterialsCollectionRef, recipesCollectionRef, firestore, companyId, productsData, salesData, companyData, products, rawMaterialsData, catalogProductsData, productsCollectionRef, ordersData, recipesData, canEdit } = core;



  const addCatalogProduct = useCallback(async (productData: Omit<CatalogProduct, 'id'>) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!catalogProductsCollectionRef) {
      throw new Error("Referência da coleção do catálogo não disponível.");
    }
    try {
      addDocumentNonBlocking(catalogProductsCollectionRef, productData);
    } catch (e) {
      console.error("Error adding catalog product:", e);
      throw new Error("Não foi possível adicionar o produto ao catálogo.");
    }
  }, [catalogProductsCollectionRef]);


  const addCatalogCategory = useCallback(async (categoryName: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!catalogCategoriesCollectionRef || !catalogCategoriesData) return;
    const trimmedName = categoryName.trim();
    if (!trimmedName) return;

    const exists = catalogCategoriesData.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      return;
    }

    try {
      addDocumentNonBlocking(catalogCategoriesCollectionRef, { name: trimmedName });
    } catch (e) {
      console.error("Error adding catalog category:", e);
      throw new Error("Não foi possível adicionar a nova categoria.");
    }
  }, [catalogCategoriesCollectionRef, catalogCategoriesData]);


  /** Aplica `build` a vários produtos do catálogo, em lotes de 400 (limite do Firestore: 500). */
  const batchCatalog = useCallback(async (ops: { id: string; data: Record<string, unknown> }[]) => {
    if (!firestore || !companyId) throw new Error('Sem ligação à empresa.');
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(firestore);
      ops.slice(i, i + 400).forEach((o) => batch.update(doc(firestore, `companies/${companyId}/catalogProducts`, o.id), o.data));
      // sem internet o commit só termina quando a ligação volta: a alteração já está guardada neste aparelho, não se espera
      if (typeof navigator !== 'undefined' && !navigator.onLine) batch.commit().catch(() => { });
      else await batch.commit();
    }
    return ops.length;
  }, [firestore, companyId]);

  const deleteCatalogProducts = useCallback(async (ids: string[]) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return 0;
    }
    if (!ids.length) return 0;
    const at = new Date().toISOString();
    try {
      return await batchCatalog(ids.map((id) => ({ id, data: { deletedAt: at, deletedBy: user?.username || 'Sistema' } })));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível apagar', description: e?.message });
      return 0;
    }
  }, [isReadOnly, toast, batchCatalog, user]);

  const updateCatalogProducts = useCallback(async (updates: { id: string; data: Partial<CatalogProduct> }[]) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return 0;
    }
    if (!updates.length) return 0;
    try {
      const n = await batchCatalog(updates.map((u) => ({ id: u.id, data: u.data as Record<string, unknown> })));
      // Preço ou custo mudado no catálogo: o stock (todas as localizações) passa a ter o mesmo — é o que a venda usa.
      const priced = updates.filter((u) => typeof u.data.price === 'number' || typeof u.data.cost === 'number');
      if (priced.length && firestore && companyId && canEdit('inventory')) {
        const nameOf = new Map((catalogProductsData || []).map((c) => [c.id, c.name]));
        const writes: { id: string; data: { price?: number; cost?: number } }[] = [];
        for (const u of priced) {
          const name = nameOf.get(u.id);
          if (!name) continue;
          for (const p of productsData || []) {
            if (!p.id || p.deletedAt || nameKey(p.name) !== nameKey(name)) continue;
            const data: { price?: number; cost?: number } = {};
            if (typeof u.data.price === 'number' && p.price !== u.data.price) data.price = u.data.price;
            if (typeof u.data.cost === 'number' && (p.cost || 0) !== u.data.cost) data.cost = u.data.cost;
            if (Object.keys(data).length) writes.push({ id: p.id, data });
          }
        }
        const at = new Date().toISOString();
        for (let i = 0; i < writes.length; i += 400) {
          const batch = writeBatch(firestore);
          writes.slice(i, i + 400).forEach((w) => batch.update(doc(firestore, `companies/${companyId}/products`, w.id), { ...w.data, lastUpdated: at }));
          if (typeof navigator !== 'undefined' && !navigator.onLine) batch.commit().catch(() => { });
          else await batch.commit();
        }
      }
      return n;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível alterar', description: e?.message });
      return 0;
    }
  }, [isReadOnly, toast, batchCatalog, firestore, companyId, canEdit, catalogProductsData, productsData]);

  const deleteCatalogCategory = useCallback(async (categoryId: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return false;
    }
    if (!firestore || !companyId) return false;
    const cat = catalogCategoriesData?.find((c) => c.id === categoryId);
    if (!cat) return false;
    // só se apaga uma categoria vazia: os produtos dela ficariam sem categoria
    const inUse = (catalogProductsData || []).filter((p) => p.category === cat.name).length;
    if (inUse > 0) {
      toast({ variant: 'destructive', title: `A categoria "${cat.name}" tem ${inUse} produto(s)`, description: 'Mude esses produtos para outra categoria (seleccione-os e use "Mudar categoria") e depois apague a categoria.' });
      return false;
    }
    try {
      const ref = doc(firestore, `companies/${companyId}/catalogCategories`, categoryId);
      if (typeof navigator !== 'undefined' && !navigator.onLine) deleteDoc(ref).catch(() => { });
      else await deleteDoc(ref);
      return true;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível apagar a categoria', description: e?.message });
      return false;
    }
  }, [isReadOnly, toast, firestore, companyId, catalogCategoriesData, catalogProductsData]);

  const addRawMaterial = useCallback(async (material: Omit<RawMaterial, 'id'>) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!rawMaterialsCollectionRef) return;
    addDocumentNonBlocking(rawMaterialsCollectionRef, material);
    toast({ title: 'Matéria-Prima Adicionada' });
  }, [rawMaterialsCollectionRef, toast]);


  /**
   * Cria uma matéria-prima e devolve o id — espera que fique gravada, porque a produção a seguir lê-a numa
   * transacção (se ainda não estivesse no servidor, dava "já não existe").
   */
  const createRawMaterial = useCallback(async (material: Omit<RawMaterial, 'id'>): Promise<string> => {
    if (isReadOnly) throw new Error('Conta em modo leitura.');
    if (!rawMaterialsCollectionRef) throw new Error('Sem acesso à matéria-prima.');
    const ref = doc(rawMaterialsCollectionRef as CollectionReference);
    await setDoc(ref, material);
    return ref.id;
  }, [rawMaterialsCollectionRef, isReadOnly]);


  const updateRawMaterial = useCallback(async (materialId: string, data: Partial<RawMaterial>) => {
    if (!rawMaterialsCollectionRef) return;
    const docRef = doc(rawMaterialsCollectionRef as CollectionReference, materialId);
    updateDocumentNonBlocking(docRef, data);
    toast({ title: 'Matéria-Prima Atualizada' });
  }, [rawMaterialsCollectionRef, toast]);


  const deleteRawMaterial = useCallback(async (materialId: string) => {
    if (!rawMaterialsCollectionRef) return;
    deleteDocumentNonBlocking(doc(rawMaterialsCollectionRef as CollectionReference, materialId));
    toast({ title: 'Matéria-Prima Removida' });
  }, [rawMaterialsCollectionRef, toast]);


  const addRecipe = useCallback(async (recipe: Omit<Recipe, 'id'>) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!recipesCollectionRef) return;
    addDocumentNonBlocking(recipesCollectionRef, recipe);
    toast({ title: 'Receita Adicionada' });
  }, [recipesCollectionRef, toast]);


  const updateRecipe = useCallback(async (recipeId: string, data: Partial<Recipe>) => {
    if (!recipesCollectionRef) return;
    const docRef = doc(recipesCollectionRef as CollectionReference, recipeId);
    updateDocumentNonBlocking(docRef, data);
    toast({ title: 'Receita Atualizada' });
  }, [recipesCollectionRef, toast]);


  /*
  const deleteRecipe = useCallback(async (recipeId: string) => {
    if (!recipesCollectionRef) return;
    deleteDocumentNonBlocking(doc(recipesCollectionRef as CollectionReference, recipeId));
    toast({ title: 'Receita Removida' });
  }, [recipesCollectionRef, toast]);
  */



  const restoreItem = useCallback(async (collectionName: string, id: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId) return;
    const docRef = doc(firestore, `companies/${companyId}/${collectionName}`, id);

    // Apagar uma venda ou encomenda repõe o stock / liberta a reserva; restaurar tem de fazer o contrário,
    // senão o registo volta mas o stock fica como se ainda estivesse apagado.
    if (collectionName === 'sales' || collectionName === 'orders') {
      try {
        const stockLocation = (loc?: string) => loc || (isMultiLocation ? locations?.[0]?.id : 'Principal') || 'Principal';
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        if (collectionName === 'sales') {
          const sale = snap.data() as Sale;
          if (sale.orderId) {
            toast({ variant: 'destructive', title: 'Venda de encomenda', description: 'Restaure a encomenda: a venda volta com ela.' });
            return;
          }
          const needsStock = (sale.status === 'Pago' || sale.status === 'Levantado') && sale.documentType !== 'Factura Proforma';
          const productRef = needsStock
            ? await resolveInventoryProductRef(firestore, companyId, { productId: sale.productId, productName: sale.productName, location: stockLocation(sale.location) })
            : null;
          if (needsStock && !productRef) throw new Error(`O produto "${sale.productName}" já não existe no inventário: não dá para repor esta venda.`);
          await runTransaction(firestore, async (transaction) => {
            if (productRef) {
              const pDoc = await transaction.get(productRef);
              if (!pDoc.exists()) throw new Error(`O produto "${sale.productName}" já não existe no inventário.`);
              const p = pDoc.data() as Product;
              if (sale.status === 'Pago') {
                const available = (p.stock || 0) - (p.reservedStock || 0);
                if (available < sale.quantity) throw new Error(`Stock insuficiente para repor esta venda. Disponível: ${available}.`);
                transaction.update(productRef, { reservedStock: (p.reservedStock || 0) + sale.quantity, lastUpdated: new Date().toISOString() });
              } else {
                if ((p.stock || 0) < sale.quantity) throw new Error(`Stock insuficiente para repor esta venda. Em stock: ${p.stock || 0}.`);
                transaction.update(productRef, { stock: (p.stock || 0) - sale.quantity, lastUpdated: new Date().toISOString() });
              }
            }
            transaction.update(docRef, { deletedAt: null, deletedBy: null });
            transaction.set(doc(collection(docRef, 'history')), {
              action: 'restaurada', userId: user?.id || 'unknown', userName: user?.username || 'Sistema', at: serverTimestamp(),
              guideNumber: sale.guideNumber || null,
            });
          });
        } else {
          const order = snap.data() as Order;
          const reserves = order.status === 'Pendente' || order.status === 'Em produção' || order.status === 'Concluída';
          const salesSnap = await getDocs(query(collection(firestore, `companies/${companyId}/sales`), where('orderId', '==', id)));
          const productRef = reserves
            ? await resolveInventoryProductRef(firestore, companyId, { productId: order.productId, productName: order.productName, location: stockLocation(order.location) })
            : null;
          await runTransaction(firestore, async (transaction) => {
            if (productRef) {
              const pDoc = await transaction.get(productRef);
              if (pDoc.exists()) {
                const p = pDoc.data() as Product;
                transaction.update(productRef, { reservedStock: (p.reservedStock || 0) + reservedToRelease(order), lastUpdated: new Date().toISOString() });
              }
            }
            transaction.update(docRef, { deletedAt: null, deletedBy: null });
            salesSnap.docs.forEach((d) => transaction.update(d.ref, { deletedAt: null, deletedBy: null }));
          });
        }
        toast({ title: 'Item Restaurado', description: 'O stock e as reservas foram refeitos.' });
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Não foi possível restaurar', description: e?.message });
      }
      return;
    }

    await updateDocumentNonBlocking(docRef, { deletedAt: null, deletedBy: null });
    toast({ title: 'Item Restaurado' });
  }, [firestore, companyId, toast, user, isMultiLocation, locations, isReadOnly]);


  const hardDelete = useCallback(async (collectionName: string, id: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId) return;
    try {
      const docRef = doc(firestore, `companies/${companyId}/${collectionName}`, id);
      await deleteDoc(docRef); // Force standard delete to ensure it waits and updates
      toast({ title: 'Item Apagado Permanentemente' });
    } catch (error: any) {
      console.error("Hard delete error:", error);
      toast({ variant: 'destructive', title: 'Erro ao Apagar', description: error.message });
    }
  }, [firestore, companyId, toast]);


  const exportCompanyData = useCallback(async () => {
    if (!productsData || !salesData) {
      toast({ variant: 'destructive', title: 'Aguarde', description: 'Os dados ainda estão a carregar.' });
      return;
    }

    const backup = {
      date: new Date().toISOString(),
      company: companyData,
      products: products,
      sales: salesData,
      clients: [], // Assuming separate clients collection later, for now implicit in sales
      version: '1.0'
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `majorstockx-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [productsData, salesData, companyData, products, toast]);


  // --- Units & Categories Management ---
  const availableUnits = useMemo(() => {
    const defaultUnits = ['un', 'kg', 'm', 'm²', 'm³', 'L', 'cxs', 'saco', 'rolo', 'cj', 'ton', 'lata', 'galão'];
    const companyUnits = companyData?.validUnits || [];
    // Also include units currently in use by products to prevent data loss or hiding
    const productUnits = productsData?.map(p => p.unit).filter(Boolean) as string[] || [];
    const materialUnits = rawMaterialsData?.map(m => m.unit).filter(Boolean) as string[] || [];

    // Merge unique
    const allUnits = Array.from(new Set([...defaultUnits, ...companyUnits, ...productUnits, ...materialUnits]));
    return allUnits.sort((a, b) => a.localeCompare(b));
  }, [companyData, productsData, rawMaterialsData]);


  const addUnit = useCallback(async (unit: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId) return;
    try {
      const companyRef = doc(firestore, 'companies', companyId);
      await updateDoc(companyRef, {
        validUnits: arrayUnion(unit)
      });
      toast({ title: 'Unidade Adicionada', description: `A unidade "${unit}" foi adicionada.` });
    } catch (error) {
      console.error("Error adding unit:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao adicionar unidade." });
    }
  }, [firestore, companyId, toast]);


  const editUnit = useCallback(async (oldUnit: string, newUnit: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !oldUnit || !newUnit) return;
    try {
      const batch = writeBatch(firestore);

      const currentValidUnits = companyData?.validUnits || [];
      const updatedValidUnits = Array.from(new Set(currentValidUnits.filter(u => u !== oldUnit).concat(newUnit)));
      const companyRef = doc(firestore, 'companies', companyId);
      batch.update(companyRef, { validUnits: updatedValidUnits });

      const productsToUpdate = productsData?.filter(p => p.unit === oldUnit) || [];
      productsToUpdate.forEach(p => {
        if (p.id) {
          const docRef = doc(firestore, `companies/${companyId}/products`, p.id);
          batch.update(docRef, { unit: newUnit, lastUpdated: new Date().toISOString() });
        }
      });

      const rawMaterialsToUpdate = rawMaterialsData?.filter(r => r.unit === oldUnit) || [];
      rawMaterialsToUpdate.forEach(r => {
        if (r.id) {
          const docRef = doc(firestore, `companies/${companyId}/rawMaterials`, r.id);
          batch.update(docRef, { unit: newUnit });
        }
      });

      await batch.commit();
      toast({ title: 'Unidade Editada', description: `A unidade "${oldUnit}" passou a "${newUnit}".` });
    } catch (error) {
      console.error("Error editing unit:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao editar a unidade." });
    }
  }, [firestore, companyId, toast, companyData, productsData, rawMaterialsData]);


  const removeUnit = useCallback(async (unit: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !unit) return;
    try {
      const companyRef = doc(firestore, 'companies', companyId);
      await updateDoc(companyRef, {
        validUnits: arrayRemove(unit)
      });
      toast({ title: 'Unidade Removida', description: `A unidade "${unit}" foi removida da lista.` });
    } catch (error) {
      console.error("Error removing unit:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao remover unidade." });
    }
  }, [firestore, companyId, toast]);


  const availableCategories = useMemo(() => {
    const catalogCats = catalogCategoriesData?.map(c => c.name) || [];
    const companyCats = companyData?.validCategories || [];
    const productCats = productsData?.map(p => p.category).filter(Boolean) as string[] || [];

    const allCats = Array.from(new Set([...catalogCats, ...companyCats, ...productCats]));
    return allCats.sort((a, b) => a.localeCompare(b));
  }, [catalogCategoriesData, companyData, productsData]);


  const addCategory = useCallback(async (category: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId) return;
    try {
      // We update company-specific categories to keep it clean
      const companyRef = doc(firestore, 'companies', companyId);
      await updateDoc(companyRef, {
        validCategories: arrayUnion(category)
      });
      toast({ title: 'Categoria Adicionada', description: `Categoria "${category}" adicionada.` });
    } catch (error) {
      console.error("Error adding category:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao adicionar categoria." });
    }
  }, [firestore, companyId, toast]);


  const editCategory = useCallback(async (oldCategory: string, newCategory: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !oldCategory || !newCategory) return;
    try {
      const batch = writeBatch(firestore);

      const currentValidCategories = companyData?.validCategories || [];
      const updatedValidCategories = Array.from(new Set(currentValidCategories.filter(c => c !== oldCategory).concat(newCategory)));
      const companyRef = doc(firestore, 'companies', companyId);
      batch.update(companyRef, { validCategories: updatedValidCategories });

      // Clean up catalogCategories: Drop old one, create new one if it doesn't exist
      const oldCatalogCat = catalogCategoriesData?.find(c => c.name.toLowerCase() === oldCategory.toLowerCase());
      if (oldCatalogCat && oldCatalogCat.id) {
        const docRef = doc(firestore, `companies/${companyId}/catalogCategories`, oldCatalogCat.id);
        batch.delete(docRef);
      }

      const newCatalogCatExists = catalogCategoriesData?.some(c => c.name.toLowerCase() === newCategory.toLowerCase());
      if (!newCatalogCatExists) {
        const newCatRef = doc(collection(firestore, `companies/${companyId}/catalogCategories`));
        batch.set(newCatRef, { name: newCategory });
      }

      const catalogProductsToUpdate = catalogProductsData?.filter(p => p.category === oldCategory) || [];
      catalogProductsToUpdate.forEach(p => {
        if (p.id) {
          const docRef = doc(firestore, `companies/${companyId}/catalogProducts`, p.id);
          batch.update(docRef, { category: newCategory });
        }
      });

      const productsToUpdate = productsData?.filter(p => p.category === oldCategory) || [];
      productsToUpdate.forEach(p => {
        if (p.id) {
          const docRef = doc(firestore, `companies/${companyId}/products`, p.id);
          batch.update(docRef, { category: newCategory, lastUpdated: new Date().toISOString() });
        }
      });

      await batch.commit();
      toast({ title: 'Categorias Fundidas', description: `A categoria "${oldCategory}" foi unificada com "${newCategory}".` });
    } catch (error) {
      console.error("Error editing category:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao editar a categoria." });
    }
  }, [firestore, companyId, toast, companyData, productsData, catalogProductsData, catalogCategoriesData]);


  const removeCategory = useCallback(async (category: string) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!firestore || !companyId || !category) return;
    try {
      const companyRef = doc(firestore, 'companies', companyId);
      await updateDoc(companyRef, {
        validCategories: arrayRemove(category)
      });
      toast({ title: 'Categoria Removida', description: `Categoria "${category}" removida.` });
    } catch (error) {
      console.error("Error removing category:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao remover categoria." });
    }
  }, [firestore, companyId, toast]);


  // Products Merge Tool
  const mergeProducts = useCallback(async (targetProductId: string, sourceProductIds: string[]) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!productsCollectionRef || !firestore || !companyId) return;

    try {
      const batch = writeBatch(firestore);
      if (!productsData) return;
      const targetProduct = productsData.find(p => p.id === targetProductId);

      if (!targetProduct) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Produto principal não encontrado.' });
        return;
      }

      let totalStockToAdd = 0;
      let totalReservedToAdd = 0;
      const sourceIdsRecord: string[] = targetProduct.sourceIds || [];

      // Calculate totals and mark sources for deletion
      for (const sourceId of sourceProductIds) {
        const sourceProduct = productsData?.find(p => p.id === sourceId);
        if (sourceProduct) {
          totalStockToAdd += (sourceProduct.stock || 0);
          totalReservedToAdd += (sourceProduct.reservedStock || 0);
          sourceIdsRecord.push(sourceId);

          // Delete source product
          const sourceRef = doc(productsCollectionRef as CollectionReference, sourceId);
          batch.delete(sourceRef);
        }
      }

      // Update target product
      const targetRef = doc(productsCollectionRef as CollectionReference, targetProductId);
      batch.update(targetRef, {
        stock: (targetProduct.stock || 0) + totalStockToAdd,
        reservedStock: (targetProduct.reservedStock || 0) + totalReservedToAdd,
        sourceIds: sourceIdsRecord,
        lastUpdated: new Date().toISOString()
      });

      await batch.commit();
      toast({
        title: 'Produtos Unificados!',
        description: `${sourceProductIds.length} produtos foram fundidos em "${targetProduct.name}".`
      });

    } catch (error) {
      console.error("Error merging products:", error);
      toast({ variant: 'destructive', title: 'Erro ao Unificar', description: 'Ocorreu um erro ao tentar unificar os produtos.' });
    }
  }, [productsCollectionRef, firestore, companyId, productsData, toast]);
  /**
   * Muda o nome de um produto em todo o programa: catálogo, stock em todas as localizações, receitas e
   * encomendas em aberto, de uma vez. O histórico fica como foi gravado e aparece com o nome novo (lib/rename.ts).
   * `family`: numa família de variações, muda o nome base de todas.
   */
  const renameProduct = useCallback(async (oldName: string, newName: string, opts: { family?: boolean; set?: { variantGroup?: string; variantValues?: Record<string, string> } } = {}): Promise<boolean> => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return false;
    }
    if (!firestore || !companyId) return false;
    if (!canEdit('inventory')) {
      toast({ variant: 'destructive', title: 'Sem permissão', description: 'Só quem gere o inventário pode mudar o nome de um produto.' });
      return false;
    }
    const catalog = catalogProductsData || [];
    const stock = productsData || [];
    const all = [...catalog, ...stock];
    const key = nameKey(oldName);
    // o do catálogo primeiro (tem a família de variações); senão o do stock
    const product = all.find((p) => nameKey(p.name) === key);
    if (!product) {
      toast({ variant: 'destructive', title: 'Produto não encontrado', description: oldName });
      return false;
    }
    const pairs = renamePairs(product, newName, all, opts.family);
    if (!pairs.length) return true;
    const clash = renameClash(pairs, all);
    if (clash) {
      toast({ variant: 'destructive', title: 'Esse nome já existe', description: `Já há um produto chamado «${clash}». Escolha outro nome.` });
      return false;
    }
    const plan = planRename(pairs, {
      catalog, products: stock,
      recipes: canEdit('raw-materials') ? (recipesData || []) : [],
      orders: canEdit('orders') ? (ordersData || []) : [],
    }, opts.family ? newName : undefined, opts.family ? undefined : opts.set);
    if (plan.catalog.length && !canEdit('settings')) {
      toast({ variant: 'destructive', title: 'Sem permissão', description: 'Este produto está no catálogo: só quem gere o catálogo pode mudar o nome.' });
      return false;
    }
    const at = new Date().toISOString();
    const writes: [string, string, Record<string, unknown>][] = [
      ...plan.catalog.map((u) => ['catalogProducts', u.id, u.data] as [string, string, Record<string, unknown>]),
      ...plan.products.map((u) => ['products', u.id, { ...u.data, lastUpdated: at }] as [string, string, Record<string, unknown>]),
      ...plan.recipes.map((u) => ['recipes', u.id, { productName: u.productName }] as [string, string, Record<string, unknown>]),
      ...plan.orders.map((u) => ['orders', u.id, { productName: u.productName }] as [string, string, Record<string, unknown>]),
    ];
    try {
      // tudo de uma vez quando cabe num lote (até 450 escritas): ou muda tudo, ou nada
      for (let i = 0; i < writes.length; i += 450) {
        const batch = writeBatch(firestore);
        for (const [col, id, data] of writes.slice(i, i + 450)) batch.update(doc(firestore, `companies/${companyId}/${col}`, id), data);
        if (typeof navigator !== 'undefined' && !navigator.onLine) batch.commit().catch(() => { });
        else await batch.commit();
      }
      return true;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível mudar o nome', description: e?.message });
      return false;
    }
  }, [isReadOnly, toast, firestore, companyId, canEdit, catalogProductsData, productsData, recipesData, ordersData]);

  /**
   * Um produto solto com stock ("Pavê Borbulha") passa a ser uma variação que já existe no catálogo
   * ("Pavê Borbulha - Preto"): stock, receitas e encomendas em aberto passam para ela; a entrada solta do
   * catálogo vai para a lixeira. Ver planMergeIntoVariant em lib/rename.ts.
   */
  const mergeIntoVariant = useCallback(async (fromName: string, targetName: string): Promise<boolean> => {
    if (isReadOnly || !firestore || !companyId) return false;
    if (!canEdit('inventory') || !canEdit('settings')) {
      toast({ variant: 'destructive', title: 'Sem permissão', description: 'Só quem gere o catálogo e o inventário pode juntar produtos a uma família.' });
      return false;
    }
    const catalog = catalogProductsData || [];
    const target = catalog.find((c) => nameKey(c.name) === nameKey(targetName));
    if (!target?.variantGroup) return false;
    const { plan, trash, clash } = planMergeIntoVariant(fromName, target, {
      catalog, products: productsData || [],
      recipes: canEdit('raw-materials') ? (recipesData || []) : [],
      orders: canEdit('orders') ? (ordersData || []) : [],
    });
    if (clash) {
      toast({ variant: 'destructive', title: `«${clash}» já tem stock aqui`, description: 'Para não somar às cegas, faça primeiro uma contagem ou escolha outra variação.' });
      return false;
    }
    const at = new Date().toISOString();
    const writes: [string, string, Record<string, unknown>][] = [
      ...plan.catalog.map((u) => ['catalogProducts', u.id, u.data] as [string, string, Record<string, unknown>]),
      ...trash.map((id) => ['catalogProducts', id, { deletedAt: at, deletedBy: user?.username || 'Sistema' }] as [string, string, Record<string, unknown>]),
      ...plan.products.map((u) => ['products', u.id, { ...u.data, lastUpdated: at }] as [string, string, Record<string, unknown>]),
      ...plan.recipes.map((u) => ['recipes', u.id, { productName: u.productName }] as [string, string, Record<string, unknown>]),
      ...plan.orders.map((u) => ['orders', u.id, { productName: u.productName }] as [string, string, Record<string, unknown>]),
    ];
    try {
      const batch = writeBatch(firestore);
      for (const [col, id, data] of writes) batch.update(doc(firestore, `companies/${companyId}/${col}`, id), data);
      if (typeof navigator !== 'undefined' && !navigator.onLine) batch.commit().catch(() => { });
      else await batch.commit();
      return true;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível juntar à família', description: e?.message });
      return false;
    }
  }, [isReadOnly, toast, firestore, companyId, canEdit, catalogProductsData, productsData, recipesData, ordersData, user]);

  return { addCatalogProduct, addCatalogCategory, deleteCatalogProducts, updateCatalogProducts, deleteCatalogCategory, addRawMaterial, createRawMaterial, updateRawMaterial, deleteRawMaterial, addRecipe, updateRecipe, restoreItem, hardDelete, exportCompanyData, availableUnits, addUnit, editUnit, removeUnit, availableCategories, addCategory, editCategory, removeCategory, mergeProducts, renameProduct, mergeIntoVariant };
}

export type SettingsActions = ReturnType<typeof useSettingsActions>;
