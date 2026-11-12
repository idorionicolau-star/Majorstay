'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/context/inventory-context';
import { formatCurrency } from '@/lib/utils';

type Rejected = { id: string; roomName: string; total: number; items: { name: string; quantity: number }[]; reason: string; by: string; at: string };
type Removed = { id: string; roomName: string; value: number; reason: string; by: string; at: string };

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-MZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ControloPage() {
  const { companyId, user, isGuest } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [removed, setRemoved] = useState<Removed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isGuest || !companyId || !isManager) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Sessão expirada. Entre de novo.');
      const res = await fetch(`/api/room-orders/review?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setRejected(json.rejectedOrders || []);
      setRemoved(json.removedConsumptions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [companyId, isGuest, isManager]);

  useEffect(() => {
    load();
  }, [load]);

  // Resumo por funcionário: quantas vezes recusou/removeu e o valor envolvido
  const byEmployee = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number }>();
    const add = (name: string, value: number) => {
      const key = name || 'Desconhecido';
      const cur = map.get(key) || { name: key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += value;
      map.set(key, cur);
    };
    rejected.forEach((r) => add(r.by, r.total));
    removed.forEach((r) => add(r.by, r.value));
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rejected, removed]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/rooms" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar aos quartos
          </Link>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            Controlo de pedidos e consumos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pedidos recusados e consumos removidos da conta, com quem fez e porquê. Veja se há padrões estranhos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-10 rounded-full gap-1.5 text-xs shrink-0">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {!isManager ? (
        <p className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-500">
          Só o administrador ou o dono pode ver este controlo.
        </p>
      ) : isGuest ? (
        <p className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-500">
          Disponível numa empresa real. O modo convidado não guarda pedidos.
        </p>
      ) : (
        <>
          {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
          {loading && <p className="text-sm text-slate-400">A carregar...</p>}

          {!loading && !error && (
            <>
              <section className="space-y-2">
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Por funcionário</h2>
                {byEmployee.length === 0 ? (
                  <p className="text-sm text-slate-400">Ainda não há recusas nem remoções registadas.</p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
                    {byEmployee.map((e) => (
                      <div key={e.name} className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] p-3.5">
                        <p className="font-bold text-sm truncate">{e.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{e.count} {e.count === 1 ? 'ação' : 'ações'} · {formatCurrency(e.value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Pedidos recusados ({rejected.length})</h2>
                {rejected.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum.</p>
                ) : (
                  <ul className="space-y-2">
                    {rejected.map((r) => (
                      <li key={r.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] p-3.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold truncate">{r.roomName || 'Quarto'}</span>
                          <span className="text-xs text-slate-400 shrink-0">{when(r.at)}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {r.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')} · {formatCurrency(r.total)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Recusado por <b>{r.by || '—'}</b>{r.reason ? ` · Motivo: ${r.reason}` : ' · Sem motivo'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Consumos removidos da conta ({removed.length})</h2>
                {removed.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum.</p>
                ) : (
                  <ul className="space-y-2">
                    {removed.map((r) => (
                      <li key={r.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] p-3.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold truncate">{r.roomName || 'Quarto'}</span>
                          <span className="text-xs text-slate-400 shrink-0">{when(r.at)}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Valor removido: {formatCurrency(r.value)}</p>
                        <p className="text-xs text-slate-500 mt-1">Removido por <b>{r.by || '—'}</b>{r.reason ? ` · Motivo: ${r.reason}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
