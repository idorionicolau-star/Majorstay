'use client';
import { inScope, sortBySite } from '@/lib/sites';
import { bootStepOf, setBootStep } from '@/lib/boot-progress';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { InventoryContextType, Product } from '@/lib/types';
import { PasswordConfirmationDialog } from '@/components/auth/password-confirmation-dialog';
import { useAuthActions } from './inventory/auth-actions';
import { useProductActions } from './inventory/product-actions';
import { useSalesActions } from './inventory/sales-actions';
import { useProductionActions } from './inventory/production-actions';
import { useOrderActions } from './inventory/order-actions';
import { useSettingsActions } from './inventory/settings-actions';
import { useOfflineSync } from './inventory/offline-sync';
import { useInventoryCore } from './inventory/core';

export const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined
);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const core = useInventoryCore();
  const { isGuest, toast, loading, productsLoading, salesLoading, productionsLoading, ordersLoading, stockMovementsLoading, catalogProductsLoading, catalogCategoriesLoading, rawMaterialsLoading, recipesLoading, companyId, firestore, user, productsData, salesData, stockMovementsData, lastSaleTimestamp, firebaseUser, isReadOnly, isTrial, daysLeft, renewInDays, subscriptionReason, logout, profilePicture, handleSetProfilePicture, canView, canEdit, companyData, products, productionsData, ordersData, catalogProductsData, catalogProductsRaw, catalogCategoriesData, rawMaterialsData, recipesData, locations: allLocations, isMultiLocation, siteScope, firstLocationId, notifications, monthlySalesChartData, dashboardStats, businessStartDate, chatHistory, setChatHistory, updateCompany, markNotificationAsRead, markAllAsRead, clearNotifications, addNotification, categorizeProductWithAI, notifyManagers } = core;
  const authActions = useAuthActions(core);
  const { login, loginWithGoogle, resetPassword, changePassword, registerCompany, registerCompanyWithGoogle } = authActions;
  const productActions = useProductActions(core);
  const { addProduct, syncSmartThresholds, setAutoThresholds, updateProduct, deleteProduct, clearProductsCollection, auditStock, transferStock, updateProductStock } = productActions;
  const salesActions = useSalesActions(core, { product_actions: productActions });
  const { addSale, addBulkSale, confirmSalePickup, deleteSale, recalculateReservedStock } = salesActions;
  const { pendingOfflineSales, syncOfflineSales } = useOfflineSync(core, { product_actions: productActions });
  const productionActions = useProductionActions(core);
  const { addProduction, addProductionLog, deleteProduction, updateProduction, restoreProduction, editProduction } = productionActions;
  const orderActions = useOrderActions(core);
  const { deleteOrder, finalizeOrder, deliverOrderPart } = orderActions;
  const settingsActions = useSettingsActions(core);
  const { addCatalogProduct, addCatalogCategory, deleteCatalogProducts, updateCatalogProducts, deleteCatalogCategory, addRawMaterial, createRawMaterial, updateRawMaterial, deleteRawMaterial, addRecipe, updateRecipe, restoreItem: restoreItemBase, hardDelete, exportCompanyData, availableUnits, addUnit, editUnit, removeUnit, availableCategories, addCategory, editCategory, removeCategory, mergeProducts, renameProduct, mergeIntoVariant } = settingsActions;
  // Restaurar uma produção refaz o stock e a matéria-prima; o resto da lixeira usa a regra geral
  // Editar um produto e mudar-lhe o nome: muda em todo o programa (senão o stock das outras localizações,
  // o catálogo e as encomendas ficavam com o nome antigo e deixavam de bater certo).
  const updateProductEverywhere = useCallback(async (instanceId: string, data: Partial<Product>) => {
    const current = products.find((p) => p.instanceId === instanceId);
    if (current && typeof data.name === 'string' && data.name.trim() && data.name.trim() !== current.name) {
      if (!(await renameProduct(current.name, data.name))) throw new Error('O nome não foi mudado.');
    }
    return updateProduct(instanceId, data);
  }, [products, renameProduct, updateProduct]);
  const restoreItem = useCallback((collectionName: string, id: string) => (collectionName === 'productions' ? restoreProduction(id) : restoreItemBase(collectionName, id)), [restoreProduction, restoreItemBase]);


  // Modo convidado: só se vende, registam despesas e gerem clientes. O resto escreveria no Firestore (recusado pelas
  // regras, ou pior, em fila para mais tarde) — por isso diz-se a verdade e não se faz nada.
  const guestBlocked = useCallback(async () => {
    toast({ title: 'Disponível na conta definitiva', description: 'No modo convidado pode vender, registar despesas e gerir clientes. Crie a sua conta para usar tudo.' });
    return undefined;
  }, [toast]);
  const guestQuiet = useCallback(async () => undefined, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockInGuest = <F extends (...args: any[]) => any>(fn: F): F => (isGuest ? (guestBlocked as unknown as F) : fn);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quietInGuest = <F extends (...args: any[]) => any>(fn: F): F => (isGuest ? (guestQuiet as unknown as F) : fn);

  const isDataLoading = loading || productsLoading || salesLoading || productionsLoading || ordersLoading || stockMovementsLoading || catalogProductsLoading || catalogCategoriesLoading || rawMaterialsLoading || recipesLoading;

  // a fase do arranque, para a barra da animação de entrada e do ecrã de carregamento (ver lib/boot-progress.ts)
  const bootStep = bootStepOf({
    authLoading: loading,
    signedIn: !!firebaseUser,
    productsLoading: productsLoading || catalogProductsLoading || catalogCategoriesLoading || rawMaterialsLoading || recipesLoading,
    salesLoading: salesLoading || productionsLoading || ordersLoading || stockMovementsLoading,
  });
  useEffect(() => { setBootStep(bootStep); }, [bootStep]);


  // 30-Day Retention Policy Cleanup
  useEffect(() => {
    if (isGuest || !companyId || !firestore || !user || user.role !== 'Admin') return;

    const cleanupOldDeletedItems = async () => {
      const retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
      const now = new Date().getTime();

      // Check Products
      if (productsData) {
        productsData.forEach(p => {
          if (p.deletedAt) {
            const deletedDate = new Date(p.deletedAt).getTime();
            if (now - deletedDate > retentionPeriod) {
              console.log(`Auto-deleting old product: ${p.name}`);
              hardDelete('products', p.id!);
            }
          }
        });
      }

      // Check Sales
      if (salesData) {
        salesData.forEach(s => {
          if (s.deletedAt) {
            const deletedDate = new Date(s.deletedAt).getTime();
            if (now - deletedDate > retentionPeriod) {
              console.log(`Auto-deleting old sale: ${s.guideNumber}`);
              hardDelete('sales', s.id);
            }
          }
        });
      }
    };

    // Run cleanup with a small delay to ensure data is loaded
    const timer = setTimeout(cleanupOldDeletedItems, 5000);
    return () => clearTimeout(timer);
  }, [isGuest, companyId, firestore, user, productsData, salesData, hardDelete]);


  // Auto-Sync Smart Thresholds Background
  useEffect(() => {
    if (isGuest || !companyId || !firestore || !productsData || !stockMovementsData) return;

    const tryAutoSync = () => {
      syncSmartThresholds();
    };

    // Run slightly after mount to not block UI rendering
    const timer = setTimeout(tryAutoSync, 8000);
    return () => clearTimeout(timer);
  }, [isGuest, companyId, firestore, productsData, stockMovementsData, syncSmartThresholds]);


  // Real-time Event-Driven Prediction Recalculation (Após Vendas)
  useEffect(() => {
    if (isGuest || !lastSaleTimestamp || lastSaleTimestamp === 0) return;

    // Wait 5 seconds to ensure Firebase snapshot is complete, then force a sync (true)
    const timer = setTimeout(() => {
      syncSmartThresholds('silent');
    }, 5000);

    return () => clearTimeout(timer);
  }, [isGuest, lastSaleTimestamp, syncSmartThresholds]);


  // confirmAction implementation
  const [confirmationAction, setConfirmationAction] = useState<(() => Promise<void>) | null>(null);

  const [confirmationTitle, setConfirmationTitle] = useState<string>("Confirmação");

  const [confirmationMessage, setConfirmationMessage] = useState<string>("");


  const confirmAction = useCallback((action: () => Promise<void>, title: string = "Confirmação", message: string = "Tem a certeza?") => {
    setConfirmationAction(() => action);
    setConfirmationTitle(title);
    setConfirmationMessage(message);
  }, []);


  const handleConfirm = async () => {
    if (confirmationAction) {
      await confirmationAction();
      setConfirmationAction(null);
    }
  };


  const scoped = useMemo(() => {
    const ok = (loc?: string | null) => inScope(siteScope, loc, firstLocationId);
    return {
      locations: sortBySite(siteScope ? allLocations.filter(l => siteScope.has(l.id)) : allLocations),
      products: siteScope ? products.filter(p => ok(p.location)) : products,
      allProducts: siteScope ? (productsData || []).filter(p => ok(p.location)) : productsData || [],
      allSales: siteScope ? (salesData || []).filter(s => ok(s.location)) : salesData || [],
      allProductions: siteScope ? (productionsData || []).filter(p => ok(p.location)) : productionsData || [],
      allOrders: siteScope ? (ordersData || []).filter(o => ok(o.location)) : ordersData || [],
      stockMovements: siteScope ? (stockMovementsData || []).filter(m => ok(m.fromLocationId) || ok(m.toLocationId)) : stockMovementsData || [],
    };
  }, [siteScope, firstLocationId, allLocations, products, productsData, salesData, productionsData, ordersData, stockMovementsData]);

  const value: InventoryContextType = useMemo(() => ({
    isGuest,
    user,
    firebaseUser,
    companyId,
    loading: isDataLoading,
    isReadOnly,
    isTrial,
    daysLeft,
    renewInDays,
    subscriptionReason,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    changePassword,
    registerCompany,
    registerCompanyWithGoogle,
    profilePicture, setProfilePicture: handleSetProfilePicture,
    canView, canEdit,
    companyData,
    // vendedor com ponto: só vê o stock, as vendas e os movimentos das localizações desse ponto
    // (as acções — vender, transferir — continuam a usar tudo, para o stock de destino somar certo)
    products: scoped.products,
    allProducts: scoped.allProducts,
    sales: scoped.allSales.filter(s => !s.deletedAt),
    allSales: scoped.allSales,
    productions: scoped.allProductions.filter(p => !p.deletedAt),
    allProductions: scoped.allProductions,
    orders: scoped.allOrders.filter(o => !o.deletedAt),
    allOrders: scoped.allOrders,
    stockMovements: scoped.stockMovements,
    catalogProducts: catalogProductsData || [],
    allCatalogProducts: catalogProductsRaw || [], // inclui a lixeira
    catalogCategories: catalogCategoriesData || [],
    rawMaterials: rawMaterialsData || [],
    recipes: recipesData || [],
    locations: scoped.locations, allLocations, isMultiLocation, notifications, monthlySalesChartData, dashboardStats,
    businessStartDate,
    chatHistory, setChatHistory,
    addProduct: blockInGuest(addProduct), updateProduct: blockInGuest(updateProductEverywhere), deleteProduct: blockInGuest(deleteProduct),
    auditStock: blockInGuest(auditStock), transferStock: blockInGuest(transferStock), updateProductStock: blockInGuest(updateProductStock), updateCompany: blockInGuest(updateCompany), addSale, addBulkSale, confirmSalePickup: blockInGuest(confirmSalePickup), addProductionLog: blockInGuest(addProductionLog),
    addProduction: blockInGuest(addProduction), updateProduction: blockInGuest(updateProduction), editProduction: blockInGuest(editProduction), deleteProduction: blockInGuest(deleteProduction), deleteOrder: blockInGuest(deleteOrder), finalizeOrder: blockInGuest(finalizeOrder), deliverOrderPart: blockInGuest(deliverOrderPart), deleteSale: blockInGuest(deleteSale),
    clearProductsCollection: blockInGuest(clearProductsCollection),
    mergeProducts: blockInGuest(mergeProducts), renameProduct: blockInGuest(renameProduct), mergeIntoVariant: blockInGuest(mergeIntoVariant),
    restoreItem: blockInGuest(restoreItem),
    hardDelete: blockInGuest(hardDelete),
    deleteCatalogProducts: blockInGuest(deleteCatalogProducts), updateCatalogProducts: blockInGuest(updateCatalogProducts), deleteCatalogCategory: blockInGuest(deleteCatalogCategory),
    exportCompanyData: blockInGuest(exportCompanyData),
    syncSmartThresholds: quietInGuest(syncSmartThresholds),
    setAutoThresholds: blockInGuest(setAutoThresholds),

    markNotificationAsRead, markAllAsRead, clearNotifications, addNotification,
    recalculateReservedStock: quietInGuest(recalculateReservedStock),
    pendingOfflineSales, syncOfflineSales: quietInGuest(syncOfflineSales),
    addCatalogProduct: blockInGuest(addCatalogProduct), addCatalogCategory: blockInGuest(addCatalogCategory),
    addRawMaterial: blockInGuest(addRawMaterial),
    createRawMaterial: blockInGuest(createRawMaterial),
    updateRawMaterial: blockInGuest(updateRawMaterial),
    deleteRawMaterial: blockInGuest(deleteRawMaterial),
    addRecipe: blockInGuest(addRecipe),
    updateRecipe: blockInGuest(updateRecipe),
    // deleteRecipe,
    categorizeProductWithAI,

    availableUnits, addUnit: blockInGuest(addUnit), editUnit: blockInGuest(editUnit), removeUnit: blockInGuest(removeUnit),
    availableCategories, addCategory: blockInGuest(addCategory), editCategory: blockInGuest(editCategory), removeCategory: blockInGuest(removeCategory),

    confirmAction,
    notifyManagers,
  }), [
    isGuest, guestBlocked, guestQuiet,
    user, firebaseUser, companyId, isDataLoading, isReadOnly, isTrial, daysLeft, renewInDays, subscriptionReason,
    login, loginWithGoogle, logout, resetPassword, registerCompany, registerCompanyWithGoogle, profilePicture, handleSetProfilePicture,
    canView, canEdit,
    companyData, productsData, salesData, productionsData, ordersData, stockMovementsData, catalogProductsData, catalogProductsRaw, catalogCategoriesData,
    rawMaterialsData, recipesData,
    scoped, allLocations, isMultiLocation, notifications, monthlySalesChartData, dashboardStats,
    businessStartDate,
    chatHistory, setChatHistory,
    addProduct, updateProductEverywhere, deleteProduct,
    auditStock, transferStock, updateProductStock, updateCompany, addSale, addBulkSale, confirmSalePickup, addProductionLog,
    addProduction, updateProduction, editProduction, deleteProduction, deleteOrder, finalizeOrder, deliverOrderPart, deleteSale,
    clearProductsCollection,
    markNotificationAsRead, markAllAsRead, clearNotifications, addNotification,
    recalculateReservedStock, pendingOfflineSales, syncOfflineSales,
    addCatalogProduct, addCatalogCategory,
    addRawMaterial,
    createRawMaterial,
    updateRawMaterial,
    addRecipe,
    updateRecipe,
    mergeProducts, renameProduct, mergeIntoVariant,
    restoreItem, deleteCatalogProducts, updateCatalogProducts, deleteCatalogCategory,
    exportCompanyData,
    availableUnits, addUnit,
    availableCategories, addCategory,
    syncSmartThresholds,
    setAutoThresholds,
    confirmAction,
    notifyManagers,
  ]);


  return (
    <InventoryContext.Provider value={value}>
      {children}
      <PasswordConfirmationDialog
        open={!!confirmationAction}
        onOpenChange={(open) => !open && setConfirmationAction(null)}
        onConfirm={handleConfirm}
        title={confirmationTitle}
        description={confirmationMessage}
      />
    </InventoryContext.Provider>
  );
}

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
