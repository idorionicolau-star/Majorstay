'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { collection, doc, getDocs, query, runTransaction, waitForPendingWrites, where } from 'firebase/firestore';
import type { Product, Sale } from '@/lib/types';
import { nextGuideNumber } from '@/lib/sale-plan';
import { isOffline } from './offline-helpers';
import type { InventoryCore } from './core';
import type { ProductActions } from './product-actions';
import { links } from '@/lib/deep-links';
import { locationIn } from '@/lib/product-ref';

const MANAGER_TAKEOVER_MS = 15 * 60 * 1000;

/**
 * Sincronização das vendas feitas sem internet.
 * Enquanto offline, a venda fica gravada neste aparelho com um número provisório (OFF-…).
 * Quando a ligação volta: 1) espera que o servidor receba tudo; 2) dá a cada documento o número
 * oficial, em sequência; 3) confere o stock e avisa os gestores se algum produto ficou negativo
 * (dois aparelhos podem ter vendido o último artigo ao mesmo tempo).
 */
export function useOfflineSync(core: InventoryCore, deps: { product_actions: ProductActions }) {
  const { firestore, companyId, user, salesData, toast, notifyManagers, isManagerUser } = core;
  const { checkStockAndNotify } = deps.product_actions;
  const running = useRef(false);

  const pendingAll = useMemo(() => (salesData || []).filter((s) => s.offlinePending && !s.deletedAt), [salesData]);

  // Cada aparelho numera as suas vendas; um gestor só assume as dos outros se ficarem esquecidas.
  const mine = useMemo(() => pendingAll.filter((s) => {
    if (s.soldBy === user?.username) return true;
    if (!isManagerUser) return false;
    const age = Date.now() - new Date(s.date).getTime();
    return !Number.isFinite(age) || age > MANAGER_TAKEOVER_MS;
  }), [pendingAll, user?.username, isManagerUser]);

  const syncOfflineSales = useCallback(async () => {
    if (running.current || !firestore || !companyId || isOffline() || mine.length === 0) return;
    running.current = true;
    try {
      // 1) o servidor tem de ter recebido as vendas antes de as podermos numerar
      await waitForPendingWrites(firestore);

      const groups = new Map<string, Sale[]>();
      for (const s of [...mine].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
        groups.set(s.guideNumber, [...(groups.get(s.guideNumber) || []), s]);
      }

      const companyRef = doc(firestore, `companies/${companyId}`);
      const salesCol = collection(firestore, `companies/${companyId}/sales`);
      const numbered: string[] = [];
      const touched = new Map<string, Sale>();

      // 2) números oficiais, um documento de cada vez
      for (const group of groups.values()) {
        const newNumber = await runTransaction(firestore, async (tx) => {
          const companyDoc = await tx.get(companyRef);
          const snaps = await Promise.all(group.map((g) => tx.get(doc(salesCol, g.id))));
          const live = snaps.filter((sn) => sn.exists() && sn.data().offlinePending);
          if (!live.length || !companyDoc.exists()) return null; // outro aparelho já numerou
          const numbering = nextGuideNumber(companyDoc.data(), String(live[0].data()!.documentType));
          tx.update(companyRef, { saleCounter: numbering.saleCounter, ...numbering.numberingUpdate });
          live.forEach((sn) => tx.update(sn.ref, { guideNumber: numbering.guideNumber, provisionalNumber: sn.data()!.guideNumber, offlinePending: false }));
          return numbering.guideNumber;
        });
        if (newNumber) {
          numbered.push(newNumber);
          group.forEach((g) => touched.set(`${g.productName}|${g.location || ''}`, g));
        }
      }

      if (numbered.length) {
        toast({
          title: `${numbered.length} venda${numbered.length > 1 ? 's' : ''} offline sincronizada${numbered.length > 1 ? 's' : ''}`,
          description: `Números oficiais: ${numbered.slice(0, 4).join(', ')}${numbered.length > 4 ? '…' : ''}`,
        });
      }

      // 3) conferir o stock dos produtos vendidos
      const productsRef = collection(firestore, `companies/${companyId}/products`);
      for (const sale of touched.values()) {
        try {
          const snap = await getDocs(query(productsRef, where('name', '==', sale.productName), where('location', 'in', locationIn(sale.location))));
          const docs = snap.docs.map((d) => d.data() as Product);
          if (!docs.length) continue;
          const stock = docs.reduce((t, p) => t + (p.stock || 0), 0);
          const reserved = docs.reduce((t, p) => t + (p.reservedStock || 0), 0);
          if (stock < 0 || reserved > stock) {
            notifyManagers({
              always: true,
              type: 'security',
              title: `⚠️ Stock inconsistente: ${sale.productName}`,
              body: `Depois de sincronizar vendas feitas offline ficou com stock ${stock} (reservado ${reserved}). Dois aparelhos podem ter vendido o último artigo ao mesmo tempo — confirme com uma contagem.`,
              link: links.product(sale.productName, sale.location),
              dedupeId: `offline-neg-${sale.productName}-${new Date().toISOString().slice(0, 10)}`,
            });
          }
          checkStockAndNotify({ ...docs[0], stock });
        } catch (e) {
          console.warn('[offline-sync] conferência de stock falhou:', e);
        }
      }
    } catch (e) {
      console.warn('[offline-sync] sincronização adiada:', e);
    } finally {
      running.current = false;
    }
  }, [firestore, companyId, mine, toast, notifyManagers, checkStockAndNotify]);

  // Tenta já, quando a internet volta, e de 30 em 30 s enquanto houver vendas por numerar.
  useEffect(() => {
    if (!mine.length) return;
    const tick = () => { syncOfflineSales(); };
    const first = setTimeout(tick, 1500);
    const timer = setInterval(tick, 30_000);
    window.addEventListener('online', tick);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener('online', tick); };
  }, [mine.length, syncOfflineSales]);

  return { pendingOfflineSales: pendingAll.length, syncOfflineSales };
}

export type OfflineSync = ReturnType<typeof useOfflineSync>;
