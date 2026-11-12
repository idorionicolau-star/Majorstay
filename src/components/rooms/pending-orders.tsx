'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Wine, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInventory } from '@/context/inventory-context';
import { authedFetch } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

type OrderLine = { productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number };
type PendingOrder = {
  id: string;
  stayId: string;
  roomName: string;
  items: OrderLine[];
  total: number;
  createdAt: string;
};

const POLL_MS = 20_000;

function hhmm(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Pedidos de bar feitos pelos hóspedes no QR do quarto, a aguardar a receção.
 * Confirmar lança os itens na conta da estadia (e abate o stock) de uma só vez; recusar não cobra nada.
 */
export function PendingRoomOrders() {
  const { companyId, isGuest } = useInventory();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (isGuest || !companyId) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(`/api/room-orders?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      setOrders(Array.isArray(json.orders) ? json.orders : []);
    } catch {
      // sem ligação: tenta outra vez no próximo ciclo
    }
  }, [companyId, isGuest]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const confirmOrder = async (order: PendingOrder) => {
    setBusyId(order.id);
    try {
      await authedFetch('/api/stays/consumption', 'POST', { companyId, stayId: order.stayId, action: 'add', orderId: order.id });
      toast({ title: 'Pedido confirmado', description: `${order.roomName}: ${formatCurrency(order.total)} lançado na conta da estadia.` });
    } catch (e) {
      toast({ title: 'Não foi possível confirmar', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });
    } finally {
      setBusyId(null);
      load();
    }
  };

  const rejectOrder = async (order: PendingOrder) => {
    setBusyId(order.id);
    try {
      await authedFetch('/api/room-orders', 'POST', { companyId, orderId: order.id, action: 'reject', reason });
      toast({ title: 'Pedido recusado', description: `${order.roomName}: nada foi cobrado.` });
      setRejectingId(null);
      setReason('');
    } catch (e) {
      toast({ title: 'Não foi possível recusar', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });
    } finally {
      setBusyId(null);
      load();
    }
  };

  if (orders.length === 0) return null;

  return (
    <section
      aria-label="Pedidos de bar pendentes"
      className="rounded-3xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Wine className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
          {orders.length === 1 ? '1 pedido de bar a aguardar' : `${orders.length} pedidos de bar a aguardar`}
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
        {orders.map((o) => (
          <div key={o.id} className="min-w-0 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-white dark:bg-[#191E25] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{o.roomName}</span>
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">{hhmm(o.createdAt)}</span>
            </div>
            <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
              {o.items.map((l) => (
                <li key={l.productId} className="flex justify-between gap-2">
                  <span className="truncate">{l.quantity}× {l.productName}</span>
                  <span className="shrink-0 font-semibold">{formatCurrency(l.totalPrice)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between text-sm font-extrabold border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>Total</span>
              <span>{formatCurrency(o.total)}</span>
            </div>
            {rejectingId === o.id ? (
              <div className="space-y-2">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" className="h-10 text-base sm:text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="h-10 rounded-xl text-xs" disabled={busyId === o.id} onClick={() => { setRejectingId(null); setReason(''); }}>
                    Voltar
                  </Button>
                  <Button type="button" className="h-10 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white" disabled={busyId === o.id} onClick={() => rejectOrder(o)}>
                    Recusar pedido
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button type="button" className="h-10 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" disabled={busyId === o.id} onClick={() => confirmOrder(o)}>
                  <Check className="h-3.5 w-3.5" />
                  {busyId === o.id ? 'A lançar...' : 'Confirmar e lançar na conta'}
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" title="Recusar" disabled={busyId === o.id} onClick={() => setRejectingId(o.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
