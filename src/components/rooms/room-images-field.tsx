'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';
import { uploadProductImage } from '@/lib/upload-product-image';

export const MAX_ROOM_IMAGES = 3;

/** Até 3 fotos do quarto. Comprime e envia como as fotos de produtos; o formulário guarda só os endereços. */
export function RoomImagesField({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const { companyId, isGuest } = useInventory();
  const [busy, setBusy] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files || !files.length || !companyId) return;
    const room = MAX_ROOM_IMAGES - value.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) toast({ title: `Só cabem ${MAX_ROOM_IMAGES} fotos por quarto`, description: `Foram usadas as primeiras ${room}.` });
    setBusy(true);
    const added: string[] = [];
    try {
      for (const f of picked) added.push(await uploadProductImage(f, getAuth(), companyId));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível enviar a foto', description: e instanceof Error ? e.message : undefined });
    } finally {
      if (added.length) onChange([...value, ...added]);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Fotos do quarto (até {MAX_ROOM_IMAGES})</p>
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative aspect-square">
            <img src={url} alt={`Foto ${i + 1} do quarto`} className="h-full w-full rounded-xl border bg-slate-100 object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
              aria-label={`Remover foto ${i + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < MAX_ROOM_IMAGES && (
          <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 dark:border-slate-700 ${busy || isGuest ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-[11px] font-semibold">{busy ? 'A enviar…' : 'Adicionar'}</span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={busy || isGuest} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {isGuest && <p className="text-[11px] text-slate-500">No modo de demonstração não é possível enviar fotos.</p>}
    </div>
  );
}
