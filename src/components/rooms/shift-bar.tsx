'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventory } from '@/context/inventory-context';
import { authedFetch } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

type Totals = { cash: number; mobile: number; card: number; other: number; total: number; count: number };
type Shift = {
  id: string; openedAt: string | null; closedAt: string | null; openingCash: number;
  difference: number | null; expectedCash: number | null; countedCash: number | null;
  live?: { totals: Totals; expectedCash: number };
};

const hhmm = (iso: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) : '';
};

/**
 * Turno do recepcionista (um por dia): abre com o fundo de caixa e fecha a contar o dinheiro.
 * O esperado vem do servidor (vendas do próprio funcionário desde que abriu), por isso não se pode "acertar" à mão.
 */
export function ShiftBar() {
  const { companyId, isGuest } = useInventory();
  const [current, setCurrent] = useState<Shift | null>(null);
  const [closedToday, setClosedToday] = useState<Shift | null>(null);
  const [otherOpen, setOtherOpen] = useState<{ employeeName: string; openedAt: string | null } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<'open' | 'close' | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (isGuest || !companyId) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(`/api/shifts?companyId=${encodeURIComponent(companyId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setCurrent(json.current || null);
      setClosedToday(json.closedToday || null);
      setOtherOpen(json.otherOpen || null);
      setLoaded(true);
    } catch {
      /* sem ligação: tenta na próxima vez */
    }
  }, [companyId, isGuest]);

  useEffect(() => { load(); }, [load]);

  // Tempo real: o turno do colega (aberto ou fechado) aparece em segundos, sem recarregar a página
  useEffect(() => {
    if (isGuest || !companyId) return;
    const tick = () => { if (document.visibilityState === 'visible' && !dialog) load(); };
    const id = setInterval(tick, 10_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [load, isGuest, companyId, dialog]);

  if (isGuest || !companyId || !loaded) return null;

  const counted = Number(amount);
  const live = current?.live;
  const diff = live && amount !== '' && Number.isFinite(counted) ? counted - live.expectedCash : null;

  const submit = async () => {
    if (amount === '' || !Number.isFinite(counted) || counted < 0) {
      toast({ variant: 'destructive', title: 'Indique um valor válido', description: dialog === 'open' ? 'O dinheiro que tem na caixa agora (pode ser 0).' : 'O dinheiro que contou na caixa.' });
      return;
    }
    try {
      setBusy(true);
      if (dialog === 'open') {
        await authedFetch('/api/shifts', 'POST', { companyId, action: 'open', openingCash: counted });
        toast({ title: 'Turno aberto', description: 'Bom trabalho!' });
      } else {
        const r = await authedFetch('/api/shifts', 'POST', { companyId, action: 'close', countedCash: counted, notes: notes.trim() });
        toast({
          title: 'Turno fechado',
          description: typeof r.difference === 'number'
            ? (r.difference === 0 ? 'A caixa está certa.' : `Diferença: ${formatCurrency(r.difference)} (${r.difference < 0 ? 'falta' : 'sobra'} dinheiro).`)
            : 'O valor contado foi registado. O gerente vai conferir.',
        });
      }
      setDialog(null); setAmount(''); setNotes('');
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível guardar o turno', description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0 text-xs">
          <Wallet className="h-4 w-4 text-[#007bb9] shrink-0" />
          {current ? (
            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">Turno aberto desde as {hhmm(current.openedAt)}</span>
          ) : closedToday ? (
            <span className="font-semibold text-slate-500 truncate">Turno de hoje fechado às {hhmm(closedToday.closedAt)}</span>
          ) : otherOpen ? (
            <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">Turno de {otherOpen.employeeName || 'outro colega'} aberto desde as {hhmm(otherOpen.openedAt)}</span>
          ) : (
            <span className="font-semibold text-amber-700 dark:text-amber-400 truncate">Sem turno aberto</span>
          )}
        </div>
        {current ? (
          <Button size="sm" variant="outline" className="h-9 rounded-full gap-1.5 text-xs" onClick={() => { setAmount(''); setDialog('close'); }}>
            <LogOut className="h-3.5 w-3.5" /> Fechar turno
          </Button>
        ) : !closedToday && otherOpen ? (
          <span className="text-[11px] text-slate-500">Abre depois de ele fechar</span>
        ) : !closedToday ? (
          <Button size="sm" className="h-9 rounded-full gap-1.5 text-xs bg-[#007bb9] hover:bg-[#006194] text-white" onClick={() => { setAmount(''); setDialog('open'); }}>
            <LogIn className="h-3.5 w-3.5" /> Abrir turno
          </Button>
        ) : null}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && !busy && setDialog(null)}>
        <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[420px] rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>{dialog === 'open' ? 'Abrir turno' : 'Fechar turno'}</DialogTitle>
            <DialogDescription>
              {dialog === 'open' ? 'Conte o dinheiro que tem na caixa agora (o fundo de caixa).' : 'Conte todo o dinheiro que tem na caixa e escreva o valor. O gerente confere depois.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            {dialog === 'close' && live && (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>Fundo de caixa</span><b>{formatCurrency(current?.openingCash || 0)}</b></div>
                <div className="flex justify-between"><span>Vendas em dinheiro</span><b>{formatCurrency(live.totals.cash)}</b></div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1"><span>Dinheiro esperado na caixa</span><b>{formatCurrency(live.expectedCash)}</b></div>
                <div className="flex justify-between text-slate-500"><span>M-Pesa / E-Mola</span><span>{formatCurrency(live.totals.mobile)}</span></div>
                <div className="flex justify-between text-slate-500"><span>POS / Cartão</span><span>{formatCurrency(live.totals.card)}</span></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="shiftAmount" className="text-xs font-bold">{dialog === 'open' ? 'Fundo de caixa (MT)' : 'Dinheiro contado (MT)'}</Label>
              <Input id="shiftAmount" type="number" inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-base rounded-2xl" autoFocus />
            </div>
            {dialog === 'close' && diff !== null && (
              <p className={`text-xs font-bold ${diff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {diff === 0 ? 'A caixa está certa.' : `${diff < 0 ? 'Falta' : 'Sobra'} ${formatCurrency(Math.abs(diff))}`}
              </p>
            )}
            {dialog === 'close' && (
              <div className="space-y-1.5">
                <Label htmlFor="shiftNotes" className="text-xs font-bold">Nota (opcional)</Label>
                <Input id="shiftNotes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="h-11 text-base rounded-2xl" />
              </div>
            )}
          </div>
          <DialogFooter className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2 sm:flex-wrap">
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialog(null)} disabled={busy}>Cancelar</Button>
            <Button className="rounded-2xl bg-[#007bb9] hover:bg-[#006194] text-white" onClick={submit} disabled={busy}>
              {busy ? 'A guardar...' : dialog === 'open' ? 'Abrir turno' : 'Fechar turno'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
