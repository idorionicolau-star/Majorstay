'use client';

import { useCallback, useEffect, useState } from 'react';
import { useInventory } from '@/context/inventory-context';
import { authedFetch } from '@/lib/api-client';
import { tabTotal, type Tab } from '@/lib/tabs';

/** Contas abertas do Lounge & Bar (actualiza sozinho). Sem permissão ou sem internet: lista vazia. */
export function useOpenTabs(intervalMs = 30_000) {
  const { companyId, isGuest } = useInventory();
  const [tabs, setTabs] = useState<Tab[]>([]);

  const load = useCallback(async () => {
    if (isGuest || !companyId) return;
    try {
      const r = await authedFetch('/api/tabs', 'POST', { companyId, action: 'list' });
      setTabs(Array.isArray(r.tabs) ? r.tabs : []);
    } catch { /* sem permissão ou sem ligação: mantém o que tinha */ }
  }, [companyId, isGuest]);

  useEffect(() => {
    load();
    const tick = () => { if (document.visibilityState === 'visible') load(); };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [load, intervalMs]);

  return { tabs, total: tabTotal(tabs.flatMap((t) => t.items)), reload: load };
}
