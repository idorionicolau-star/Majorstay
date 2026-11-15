'use client';

import { useCallback, useEffect, useState } from 'react';
import { useInventory } from '@/context/inventory-context';
import { authedFetch } from '@/lib/api-client';

export type DayDish = { id: string; name: string; price: number; available: number };

/** Pratos do dia (menu e doses disponíveis hoje). Atualiza a cada 20 s. */
export function useDishes(enabled = true) {
  const { companyId, isGuest } = useInventory();
  const [dishes, setDishes] = useState<DayDish[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!companyId || isGuest || !enabled) return;
    try {
      const r = await authedFetch('/api/dishes', 'POST', { companyId, action: 'list' });
      setDishes(Array.isArray(r.dishes) ? r.dishes : []);
    } catch {
      /* mantém a lista anterior */
    }
  }, [companyId, isGuest, enabled]);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
    const t = setInterval(reload, 20_000);
    return () => clearInterval(t);
  }, [reload, enabled]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (!companyId) return;
      await authedFetch('/api/dishes', 'POST', { companyId, ...body });
      await reload();
    },
    [companyId, reload]
  );

  return { dishes, loading, reload, act };
}
