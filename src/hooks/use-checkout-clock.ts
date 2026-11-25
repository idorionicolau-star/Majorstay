'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { nowDate, syncServerTime } from '@/lib/server-time';

type Anchor = { serverMs: number; perf: number };

/**
 * O relógio do check-out: ancorado numa cotação do servidor (a hora dele, pedida ao abrir e de minuto a minuto),
 * e a andar com o relógio monotónico do navegador entre cotações. Não depende da hora do PC nem do desvio guardado.
 * Se o servidor não responder, cai para a hora estimada da app (`source: 'estimate'`) e a app avisa.
 */
export function useCheckoutClock(opts: { open: boolean; enabled: boolean; companyId?: string | null; stayId?: string; roomId?: string }) {
  const { open, enabled, companyId, stayId, roomId } = opts;
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [failed, setFailed] = useState(false);
  const [, setTick] = useState(0);
  const anchorRef = useRef<Anchor | null>(null);
  anchorRef.current = anchor;

  /** Aplica uma hora do servidor (de uma cotação ou de uma resposta do check-out); `rttMs` = demora da resposta, se se souber. */
  const applyQuote = useCallback((q: { serverNow: number }, rttMs = 0) => {
    setAnchor({ serverMs: q.serverNow + rttMs / 2, perf: performance.now() });
    setFailed(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !companyId || !stayId || !roomId) return;
    try {
      const t0 = performance.now();
      const r = await authedFetch('/api/stays/checkout', 'POST', { action: 'quote', companyId, stayId, roomId });
      const rtt = performance.now() - t0;
      if (r?.quote?.serverNow) applyQuote(r.quote, rtt);
    } catch {
      setFailed(true);
    }
  }, [enabled, companyId, stayId, roomId, applyQuote]);

  useEffect(() => {
    if (!open) { setAnchor(null); setFailed(false); return; }
    void syncServerTime(); // melhora também a hora estimada de reserva
    void refresh();
    const q = setInterval(() => { void refresh(); }, 60_000);
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => { clearInterval(q); clearInterval(t); };
  }, [open, refresh]);

  const now = (): Date => {
    const a = anchorRef.current;
    return a ? new Date(a.serverMs + (performance.now() - a.perf)) : nowDate();
  };

  return { now, source: anchor ? ('server' as const) : ('estimate' as const), failed, applyQuote, refresh };
}
