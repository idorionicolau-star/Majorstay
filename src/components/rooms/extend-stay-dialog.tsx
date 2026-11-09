'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, PlusCircle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Stay, Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';
import { calculateExpectedCheckOut, normalizeDate } from '@/lib/hospitality-calc';

interface ExtendStayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stay: Stay | null;
  room: Room | null;
}

const EXTENSION_OPTIONS = [1, 2, 3, 4, 6];

export function ExtendStayDialog({ open, onOpenChange, stay, room }: ExtendStayDialogProps) {
  const { extendStay } = useRooms();

  const [hours, setHours] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!stay) return null;

  const currentExpected = calculateExpectedCheckOut(stay.checkInAt, stay.contractedHours, stay.extensions);
  const tempExtensions = [...(stay.extensions || []), { hours, addedAt: new Date(), addedBy: '' }];
  const newExpected = calculateExpectedCheckOut(stay.checkInAt, stay.contractedHours, tempExtensions);

  const ratePerHour = stay.ratePerHourApplied || room?.ratePerHour || 0;
  const extraAmount = hours * ratePerHour;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stay.id) return;

    try {
      setLoading(true);
      await extendStay(stay.id, hours, notes.trim());
      onOpenChange(false);
      setHours(1);
      setNotes('');
    } catch (err: any) {
      console.error('Erro ao prorrogar estadia:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao prorrogar',
        description: err.message || 'Não foi possível prorrogar a estadia.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <PlusCircle className="h-6 w-6 text-blue-600" />
            Prorrogar Estadia / Horas Extras
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Identificação do Quarto e Hóspede */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-sm space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {stay.roomName || room?.name || 'Quarto'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {stay.clientName || 'Hóspede Particular'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Tarifa aplicada: <strong>{formatCurrency(ratePerHour)}/hora</strong>
            </p>
          </div>

          {/* Seleção de Horas Extras */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Adicionar Horas de Permanência *
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {EXTENSION_OPTIONS.map((h) => (
                <Button
                  key={h}
                  type="button"
                  variant={hours === h ? 'default' : 'outline'}
                  size="sm"
                  className="font-bold text-sm h-10"
                  onClick={() => setHours(h)}
                >
                  +{h}h
                </Button>
              ))}
            </div>
          </div>

          {/* Comparativo de Horários e Valor Adicional */}
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Saída Prevista Anterior:</span>
              <span className="font-medium">
                {currentExpected.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-300">
              <span className="flex items-center gap-1">
                Nova Saída Prevista:
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm">
                {newExpected.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="pt-2 border-t border-blue-200 dark:border-blue-900 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Valor Adicional a Cobrar:</span>
              <span className="text-base font-extrabold text-blue-700 dark:text-blue-400">
                +{formatCurrency(extraAmount)}
              </span>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="extNotes" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Motivo / Observações (opcional)
            </Label>
            <Textarea
              id="extNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Hóspede solicitou mais tempo na receção..."
              rows={2}
              className="resize-none text-xs"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'A Prorrogar...' : `Adicionar +${hours}h (${formatCurrency(extraAmount)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
