'use client';

import React, { useState } from 'react';
import { Utensils, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useInventory } from '@/context/inventory-context';
import { useDishes, type DayDish } from '@/hooks/use-dishes';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function PratosPage() {
  const { canEdit } = useInventory();
  const editable = canEdit('rooms');
  const { dishes, loading, act } = useDishes();
  const [editing, setEditing] = useState<DayDish | 'new' | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  // valores a meio de edição na própria lista (guardam ao sair do campo ou com Enter)
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await act(body);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível guardar', description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (d: DayDish | 'new') => {
    setEditing(d);
    setName(d === 'new' ? '' : d.name);
    setPrice(d === 'new' ? '' : String(d.price));
    setQty(d === 'new' ? '' : String(d.available));
  };

  const commitQty = async (d: DayDish) => {
    const raw = draft[d.id];
    if (raw === undefined) return;
    setDraft((p) => { const n = { ...p }; delete n[d.id]; return n; });
    const n = Math.floor(Number(raw));
    if (raw.trim() === '' || !Number.isFinite(n) || n < 0 || n === d.available) return;
    await run({ action: 'setQty', id: d.id, qty: n });
  };

  const save = async () => {
    await run({ action: 'save', ...(editing && editing !== 'new' ? { id: editing.id } : {}), name, price: Number(price.replace(',', '.')), qty: qty.trim() === '' ? 0 : Number(qty) });
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2"><Utensils className="h-5 w-5" /> Pratos do dia</h1>
          <p className="text-xs text-muted-foreground">Diga quantas doses há hoje. Cada pedido confirmado desconta 1; a 0 o prato fica esgotado. Volta a zero todas as manhãs (05:00).</p>
        </div>
        {editable && (
          <Button onClick={() => openEditor('new')} className="rounded-full shrink-0"><Plus className="h-4 w-4 mr-1" /> Novo prato</Button>
        )}
      </div>

      {loading && dishes.length === 0 ? <p className="text-sm text-muted-foreground">A carregar...</p> : null}
      {!loading && dishes.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há pratos. {editable ? 'Crie o primeiro em "Novo prato".' : ''}</p>}

      <div className="space-y-2">
        {dishes.map((d) => (
          <div key={d.id} className="rounded-2xl border p-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{d.name}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(d.price)}</p>
              {d.available <= 0 && <p className="text-[11px] font-bold text-rose-600">Esgotado</p>}
            </div>
            {editable ? (
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col items-center">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    aria-label={`Doses de ${d.name}`}
                    value={draft[d.id] ?? String(d.available)}
                    onChange={(e) => setDraft((p) => ({ ...p, [d.id]: e.target.value }))}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => commitQty(d)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="h-10 w-20 text-center text-lg font-black tabular-nums rounded-xl"
                    disabled={busy}
                  />
                  <span className="text-[10px] text-muted-foreground">doses hoje</span>
                </div>
                <Button size="sm" variant="ghost" className="text-xs" disabled={busy || d.available <= 0} onClick={() => run({ action: 'setQty', id: d.id, qty: 0 })}>Esgotar</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditor(d)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => { if (window.confirm(`Apagar "${d.name}"?`)) run({ action: 'delete', id: d.id }); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ) : (
              <span className="text-lg font-black tabular-nums">{d.available}</span>
            )}
          </div>
        ))}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Novo prato' : 'Editar prato'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="dishName">Nome</Label><Input id="dishName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Frango com batata" /></div>
            <div className="space-y-1.5"><Label htmlFor="dishPrice">Preço (MT)</Label><Input id="dishPrice" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 450" /></div>
            <div className="space-y-1.5"><Label htmlFor="dishQty">Doses disponíveis hoje</Label><Input id="dishQty" type="number" inputMode="numeric" min={0} max={999} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Ex: 10" /></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy} className="rounded-full">Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
