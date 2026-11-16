'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Receipt, Plus, Trash2, BedDouble } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventory } from '@/context/inventory-context';
import { useRooms } from '@/context/rooms-context';
import { authedFetch } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, normalizeString } from '@/lib/utils';
import { tabTotal, type Tab } from '@/lib/tabs';
import { isKitchenProduct } from '@/lib/features';

const PAYMENTS = ['Numerário', 'M-Pesa', 'e-Mola', 'Transferência', 'POS / Cartão'];

/** Contas abertas: o cliente consome e paga no fim (ou passa a conta para o quarto). */
export function OpenTabs() {
  const { companyId, products, isGuest } = useInventory();
  const { openStays } = useRooms();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState(PAYMENTS[0]);
  const [stayId, setStayId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (isGuest || !companyId) return;
    try {
      const r = await authedFetch('/api/tabs', 'POST', { companyId, action: 'list' });
      setTabs(r.tabs || []);
    } catch { /* tenta de novo mais tarde */ }
  }, [companyId, isGuest]);

  useEffect(() => { load(); }, [load]);

  const active = tabs.find((t) => t.id === activeId) || null;
  const list = useMemo(() => {
    const q = normalizeString(search);
    return products
      .filter((p) => !p.deletedAt && !isKitchenProduct(p) && (Number(p.price) || 0) > 0 && (!q || normalizeString(p.name).includes(q)))
      .slice(0, 30);
  }, [products, search]);

  if (isGuest || !companyId) return null;

  const run = async (body: Record<string, unknown>, ok?: string) => {
    try {
      setBusy(true);
      const r = await authedFetch('/api/tabs', 'POST', { companyId, ...body });
      if (ok) toast({ title: ok });
      await load();
      return r;
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível', description: e instanceof Error ? e.message : undefined });
      return null;
    } finally {
      setBusy(false);
    }
  };

  // Toque rápido: mostra logo no ecrã e confirma com o servidor em segundo plano (sem recarregar a lista).
  const quick = async (tabId: string, body: Record<string, unknown>, optimistic: (items: Tab['items']) => Tab['items']) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, items: optimistic(t.items) } : t)));
    try {
      const r = await authedFetch('/api/tabs', 'POST', { companyId, tabId, ...body });
      if (Array.isArray(r.items)) setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, items: r.items } : t)));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível', description: e instanceof Error ? e.message : undefined });
      await load();
    }
  };
  const addOne = (tabId: string, p: { id: string; name: string; price?: number; stock?: number }) => {
    const price = Number(p.price) || 0;
    quick(tabId, { action: 'add', productId: p.id, quantity: 1 }, (items) => {
      const ex = items.find((i) => i.productId === p.id && i.unitPrice === price);
      if (ex) return items.map((i) => (i === ex ? { ...i, quantity: i.quantity + 1, totalPrice: Math.round((i.quantity + 1) * i.unitPrice * 100) / 100 } : i));
      return [...items, { id: `tmp-${Date.now()}`, productId: p.id, productName: p.name, quantity: 1, unitPrice: price, totalPrice: price, addedAt: new Date().toISOString(), addedByName: '' }];
    });
  };
  const decOne = (tabId: string, itemId: string) =>
    quick(tabId, { action: 'dec', itemId }, (items) => items.map((i) => (i.id === itemId && i.quantity > 1 ? { ...i, quantity: i.quantity - 1, totalPrice: Math.round((i.quantity - 1) * i.unitPrice * 100) / 100 } : i)));

  const create = async () => {
    const r = await run({ action: 'open', clientName: newName, phone: newPhone });
    if (r?.id) { setNewOpen(false); setNewName(''); setNewPhone(''); setActiveId(r.id); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold"><Receipt className="h-4 w-4 text-[#007bb9]" /> Contas abertas ({tabs.length})</div>
        <Button size="sm" className="h-9 rounded-full gap-1 bg-[#007bb9] hover:bg-[#006194] text-white" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nova conta</Button>
      </div>
      {tabs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveId(t.id)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs active:scale-95">
              <div className="font-bold">{t.clientName}</div>
              <div className="text-slate-500">{formatCurrency(tabTotal(t.items))}</div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={(o) => !busy && setNewOpen(o)}>
        <DialogContent className="w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[380px] rounded-3xl">
          <DialogHeader><DialogTitle>Nova conta</DialogTitle><DialogDescription>Nome do cliente (obrigatório).</DialogDescription></DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Nome do cliente" className="h-11 text-base rounded-2xl" autoFocus />
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} maxLength={20} inputMode="tel" placeholder="Telefone (opcional)" className="h-11 text-base rounded-2xl" />
          <Button className="rounded-2xl bg-[#007bb9] hover:bg-[#006194] text-white" disabled={busy || newName.trim().length < 2} onClick={create}>Abrir conta</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!active} onOpenChange={(o) => !o && !busy && setActiveId(null)}>
        <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[480px] rounded-3xl p-0 overflow-hidden">
          {active && (
            <>
              <DialogHeader className="px-5 pt-5">
                <DialogTitle>Conta de {active.clientName}</DialogTitle>
                <DialogDescription>{active.phone ? `${active.phone} · ` : ''}Aberta por {active.openedByName}. O stock desce ao lançar.</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-3">
                <div className="space-y-1">
                  {active.items.length === 0 && <p className="text-xs text-slate-500">Ainda sem itens.</p>}
                  {active.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{it.productName}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <button aria-label="Menos um" disabled={it.quantity <= 1 || it.id.startsWith('tmp-')} className="h-8 w-8 rounded-full border text-base disabled:opacity-30" onClick={() => decOne(active.id, it.id)}>−</button>
                        <b className="w-6 text-center">{it.quantity}</b>
                        <button aria-label="Mais um" className="h-8 w-8 rounded-full border text-base" onClick={() => addOne(active.id, { id: it.productId, name: it.productName, price: it.unitPrice })}>+</button>
                        <span className="w-20 text-right">{formatCurrency(it.totalPrice)}</span>
                        <button aria-label="Retirar" disabled={busy} className="text-rose-600" onClick={() => {
                          const reason = window.prompt('Motivo para retirar este item?');
                          if (reason && reason.trim().length >= 3) run({ action: 'remove', tabId: active.id, itemId: it.id, reason });
                        }}><Trash2 className="h-4 w-4" /></button>
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{formatCurrency(tabTotal(active.items))}</span></div>
                </div>
                <Input placeholder="Procurar produto…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-2xl" />
                <div className="grid grid-cols-2 gap-2">
                  {list.map((p) => (
                    <button key={p.id} disabled={(Number(p.stock) || 0) < 1} onClick={() => { if (p.id) addOne(active.id, { id: p.id, name: p.name, price: p.price }); }}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-left text-xs disabled:opacity-40 active:scale-95">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-slate-500">{formatCurrency(Number(p.price) || 0)} · stock {Number(p.stock) || 0}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t px-5 py-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={payment} onValueChange={setPayment}>
                    <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy || active.items.length === 0}
                    onClick={async () => { const r = await run({ action: 'close', tabId: active.id, paymentMethod: payment }, 'Conta paga'); if (r) setActiveId(null); }}>
                    Cobrar {formatCurrency(tabTotal(active.items))}
                  </Button>
                </div>
                {openStays.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={stayId} onValueChange={setStayId}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="Quarto…" /></SelectTrigger>
                      <SelectContent>{openStays.map((s) => <SelectItem key={s.id} value={s.id}>{s.roomName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" className="h-11 rounded-2xl gap-1" disabled={busy || !stayId || active.items.length === 0}
                      onClick={async () => { const r = await run({ action: 'toRoom', tabId: active.id, stayId }, 'Passada para o quarto'); if (r) { setActiveId(null); setStayId(''); } }}>
                      <BedDouble className="h-4 w-4" /> Passar p/ quarto
                    </Button>
                  </div>
                )}
                {active.items.length === 0 && (
                  <Button variant="ghost" className="w-full text-rose-600" disabled={busy} onClick={async () => { const r = await run({ action: 'cancel', tabId: active.id }); if (r) setActiveId(null); }}>Apagar conta vazia</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
