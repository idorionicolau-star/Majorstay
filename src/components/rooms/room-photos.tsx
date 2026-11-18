'use client';

import { useState } from 'react';
import { Images } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Botão "N fotos"; ao tocar abre uma galeria grande (passa-se com o dedo) para mostrar o quarto ao cliente. */
export function RoomPhotos({ name, images }: { name: string; images?: string[] }) {
  const [open, setOpen] = useState(false);
  const list = (images || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-full bg-[#007bb9] px-3.5 text-xs font-bold text-white shadow-md active:scale-95"
        aria-label={`Ver fotos de ${name}`}
      >
        <Images className="h-4 w-4" /> Ver {list.length === 1 ? 'foto' : `${list.length} fotos`}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[96dvh] w-full max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-3xl p-3 sm:max-w-3xl">
          <DialogHeader className="px-2 pt-1"><DialogTitle>{name}</DialogTitle></DialogHeader>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {list.map((url, i) => (
              <figure key={url} className="relative w-full shrink-0 snap-center">
                <img src={url} alt={`${name} — foto ${i + 1}`} className="max-h-[70dvh] w-full rounded-2xl bg-slate-100 object-contain" />
                <figcaption className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-bold text-white">{i + 1} / {list.length}</figcaption>
              </figure>
            ))}
          </div>
          {list.length > 1 && <p className="text-center text-xs text-slate-500">Passe o dedo para o lado para ver as outras fotos.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Cama em néon, apagada, para quartos ainda sem fotos (fundo do cartão). */
export function NeonBed() {
  return (
    <svg viewBox="0 0 200 140" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="w-[62%] max-w-[260px] text-sky-400 opacity-40 dark:opacity-35"
      style={{ filter: 'drop-shadow(0 0 6px currentColor) drop-shadow(0 0 16px currentColor)' }}>
      <path d="M18 112V34" />
      <path d="M18 80h164v32" />
      <path d="M182 112V80" />
      <path d="M18 80V62a10 10 0 0 1 10-10h40a10 10 0 0 1 10 10v18" />
      <path d="M96 80V66a10 10 0 0 1 10-10h58a18 18 0 0 1 18 18v6" />
    </svg>
  );
}
