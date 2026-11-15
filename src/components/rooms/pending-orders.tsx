'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Wine, Check, X, Clock, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInventory } from '@/context/inventory-context';
import { authedFetch } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { ETA_CHOICES, minutesLeft, orderUrgency } from '@/lib/order-alert';
import { stopOrderAlert } from '@/lib/beep';

type OrderLine = { productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string; weightKg?: number };
type PendingOrder = {
  id: string;
  stayId: string;
  roomName: string;
  items: OrderLine[];
  notes?: string;
  total: number;
  createdAt: string;
  status?: string;
  etaAt?: string;
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
  const [etas, setEtas] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    if (isGuest || !companyId) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(`/api/room-orders?companyId=${encodeURIComponent(companyId)}&status=active`, {
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
    stopOrderAlert();
    setBusyId(order.id);
    const orderEta = etas[order.id] ?? 15;
    try {
      await authedFetch('/api/stays/consumption', 'POST', { companyId, stayId: order.stayId, action: 'add', orderId: order.id, etaMinutes: orderEta });
      toast({ title: 'Pedido confirmado', description: `${order.roomName}: ${formatCurrency(order.total)} lançado na conta. Pronto em ${orderEta >= 60 ? '1 hora' : `${orderEta} min`}.` });
    } catch (e) {
      toast({ title: 'Não foi possível confirmar', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });
    } finally {
      setBusyId(null);
      load();
    }
  };

  const deliverOrder = async (order: PendingOrder) => {
    stopOrderAlert();
    setBusyId(order.id);
    try {
      await authedFetch('/api/room-orders', 'POST', { companyId, orderId: order.id, action: 'delivered' });
      toast({ title: 'Entregue', description: `${order.roomName}: pedido entregue.` });
    } catch (e) {
      toast({ title: 'Não foi possível marcar como entregue', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });
    } finally {
      setBusyId(null);
      load();
    }
  };

  const rejectOrder = async (order: PendingOrder) => {
    stopOrderAlert();
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
  void tick;
  const waiting = orders.filter((o) => o.status !== 'confirmed');
  const toDeliver = orders.filter((o) => o.status === 'confirmed');

  return (
    <section
      aria-label="Pedidos de bar pendentes"
      className="rounded-3xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Wine className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
          {waiting.length > 0 ? (waiting.length === 1 ? '1 pedido a aguardar' : `${waiting.length} pedidos a aguardar`) : 'Pedidos a entregar'}{toDeliver.length > 0 && waiting.length > 0 ? ` · ${toDeliver.length} a entregar` : ''}
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
        {[...waiting, ...toDeliver].map((o) => {
          const urg = orderUrgency({ id: o.id, status: o.status || 'pending', createdAt: o.createdAt, etaAt: o.etaAt });
          const left = minutesLeft(o.etaAt);
          return (
          <div key={o.id} className={cn('min-w-0 rounded-2xl border bg-white dark:bg-[#191E25] p-3.5 space-y-2.5', urg === 'ok' ? 'border-amber-200/80 dark:border-amber-900/50' : 'border-rose-400 ring-2 ring-rose-300/60')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{o.roomName}</span>
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">{hhmm(o.createdAt)}</span>
            </div>
            {urg === 'accept-late' && <p className="text-[11px] font-bold text-rose-600">À espera há mais de 3 minutos — aceite ou recuse.</p>}
            {o.status === 'confirmed' && (
              <p className={cn('flex items-center gap-1 text-[11px] font-bold', urg === 'delivery-late' ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400')}>
                <Clock className="h-3.5 w-3.5" />
                {left === null ? 'A preparar' : urg !== 'delivery-late' ? `A preparar — pronto em ${Math.max(left, 0)} min (${hhmm(o.etaAt || '')})` : `Atrasado há ${Math.max(1, -left)} min — era para as ${hhmm(o.etaAt || '')}`}
              </p>
            )}
            <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
              {o.items.map((l) => (
                <li key={l.productId}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{l.weightKg ? `${String(l.weightKg).replace('.', ',')} kg de` : `${l.quantity}×`} {l.productName}</span>
                    <span className="shrink-0 font-semibold">{formatCurrency(l.totalPrice)}</span>
                  </div>
                  {l.notes && <p className="text-[11px] italic text-amber-700 dark:text-amber-300">Obs: {l.notes}</p>}
                </li>
              ))}
            </ul>
            {o.notes && <p className="text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800/60 p-1.5 text-slate-600 dark:text-slate-300">Nota do quarto: {o.notes}</p>}
            <div className="flex justify-between text-sm font-extrabold border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>Total</span>
              <span>{formatCurrency(o.total)}</span>
            </div>
            {o.status === 'confirmed' ? (
              <Button type="button" className="h-10 w-full rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white gap-1.5" disabled={busyId === o.id} onClick={() => deliverOrder(o)}>
                <PackageCheck className="h-3.5 w-3.5" /> {busyId === o.id ? 'A guardar...' : 'Entregue'}
              </Button>
            ) : rejectingId === o.id ? (
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
              <>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-slate-500">Pronto em:</span>
                {ETA_CHOICES.map((m) => {
                  const currentEta = etas[o.id] ?? 15;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEtas((prev) => ({ ...prev, [o.id]: m }))}
                      className={cn(
                        'h-7 rounded-full px-2.5 font-bold border transition-colors',
                        currentEta === m
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      )}
                    >
                      {m >= 60 ? '1 h' : `${m} min`}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button type="button" className="h-10 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" disabled={busyId === o.id} onClick={() => confirmOrder(o)}>
                  <Check className="h-3.5 w-3.5" />
                  {busyId === o.id ? 'A lançar...' : 'Confirmar e lançar na conta'}
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" title="Recusar" disabled={busyId === o.id} onClick={() => setRejectingId(o.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              </>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
