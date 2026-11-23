'use client';

import { useCallback, useEffect, useState } from 'react';
import { useInventory } from '@/context/inventory-context';

export type ShiftWindow = { from: Date; to: Date | null; open: boolean };

/**
 * O turno que conta agora (o aberto, ou o último fechado): os totais "do turno" começam do zero a cada abertura.
 * null = ainda não carregou, ou a empresa nunca teve turnos (os totais voltam a ser os do dia).
 */
export function useShiftWindow(): ShiftWindow | null {
  const { companyId, isGuest } = useInventory();
  const [win, setWin] = useState<ShiftWindow | null>(null);

  const load = useCallback(async () => {
    if (isGuest || !companyId) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(`/api/shifts?companyId=${encodeURIComponent(companyId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!res.ok) return;
      const w = (await res.json()).window as { from: string; to: string | null; status: string } | null;
      setWin(w ? { from: new Date(w.from), to: w.to ? new Date(w.to) : null, open: w.status === 'open' } : null);
    } catch { /* sem ligação: mantém o que tinha */ }
  }, [companyId, isGuest]);

  useEffect(() => {
    load();
    if (isGuest || !companyId) return;
    const tick = () => { if (document.visibilityState === 'visible') load(); };
    const id = setInterval(tick, 20_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [load, isGuest, companyId]);

  return win;
}
