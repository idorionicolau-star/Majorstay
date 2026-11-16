'use client';

import React, { useState } from 'react';
import { Car, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';
import type { Stay } from '@/lib/types';

/** Linha do veículo no cartão do quarto: mostra os dados e deixa preencher ou corrigir depois do check-in. */
export function StayVehicle({ stay }: { stay: Stay }) {
  const { updateStayVehicle } = useRooms();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');

  const summary = [stay.vehiclePlate, [stay.vehicleBrand, stay.vehicleModel].filter(Boolean).join(' '), stay.vehicleColor].filter(Boolean).join(' · ');

  const openDialog = () => {
    setPlate(stay.vehiclePlate || '');
    setBrand(stay.vehicleBrand || '');
    setModel(stay.vehicleModel || '');
    setColor(stay.vehicleColor || '');
    setOpen(true);
  };

  const save = async () => {
    try {
      setBusy(true);
      await updateStayVehicle(stay.id, { vehiclePlate: plate, vehicleBrand: brand, vehicleModel: model, vehicleColor: color });
      setOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível guardar o veículo', description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const field = 'h-11 text-base rounded-2xl';

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-left text-xs active:scale-[0.99]"
      >
        <Car className="h-4 w-4 shrink-0 text-slate-500" />
        <span className={summary ? 'min-w-0 flex-1 truncate font-semibold text-slate-700 dark:text-slate-200' : 'flex-1 text-slate-500'}>
          {summary || 'Adicionar veículo (matrícula, marca, modelo, cor)'}
        </span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[420px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Veículo do hóspede</DialogTitle>
            <DialogDescription>{stay.roomName}. Pode preencher agora ou corrigir mais tarde.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sv-plate" className="text-xs font-bold">Matrícula</Label>
              <Input id="sv-plate" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} maxLength={15} autoCapitalize="characters" autoComplete="off" placeholder="AAA 123 MC" className={`${field} font-mono font-bold`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sv-brand" className="text-xs font-bold">Marca</Label>
                <Input id="sv-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={30} placeholder="Toyota" className={field} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sv-model" className="text-xs font-bold">Modelo</Label>
                <Input id="sv-model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={30} placeholder="Hilux" className={field} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-color" className="text-xs font-bold">Cor</Label>
              <Input id="sv-color" value={color} onChange={(e) => setColor(e.target.value)} maxLength={30} placeholder="Branco" className={field} />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex-wrap">
            <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button className="rounded-2xl bg-[#007bb9] hover:bg-[#006194] text-white" onClick={save} disabled={busy}>{busy ? 'A guardar...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
