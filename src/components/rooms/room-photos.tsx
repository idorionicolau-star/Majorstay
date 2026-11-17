'use client';

import { useState } from 'react';
import { Images } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Miniatura da primeira foto do quarto; ao tocar, mostra todas (até 3). */
export function RoomPhotos({ name, images }: { name: string; images?: string[] }) {
  const [open, setOpen] = useState(false);
  const list = (images || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-slate-100" aria-label={`Ver fotos de ${name}`}>
        <img src={list[0]} alt={name} className="h-full w-full object-cover" loading="lazy" />
        {list.length > 1 && (
          <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <Images className="h-3 w-3" /> {list.length}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader><DialogTitle>{name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {list.map((url, i) => <img key={url} src={url} alt={`${name} — foto ${i + 1}`} className="w-full rounded-2xl border object-cover" />)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
