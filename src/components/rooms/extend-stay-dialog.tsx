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
import { Clock, PlusCircle, ArrowRight, UserCheck, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Stay, Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';
import { calculateExpectedCheckOut } from '@/lib/hospitality-calc';

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
      <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[460px] overflow-hidden p-0 rounded-3xl bg-white dark:bg-[#191E25] border border-blue-100/90 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100">
        {/* Faixa superior pastel nobre */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a] shrink-0" />

        <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 shrink-0 flex flex-row items-center justify-between space-y-0 text-left border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Prorrogar Estadia
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Adicione mais horas de permanência ao hóspede
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 px-6 sm:px-7 py-3 space-y-4">
          {/* Identificação do Quarto e Hóspede */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-sm space-y-2 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-slate-900 dark:text-white">
                {stay.roomName || room?.name || 'Quarto'}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border border-blue-200/60 dark:border-blue-800/50 font-bold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                {stay.clientName || 'Hóspede Particular'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/80 dark:border-slate-800">
              <span>Tarifa horária acordada:</span>
              <strong className="text-slate-900 dark:text-white font-bold">{formatCurrency(ratePerHour)}/hora</strong>
            </div>
          </div>

          {/* Seleção de Horas Extras - Pílulas Stitch 3 */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Adicionar Horas de Permanência *
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {EXTENSION_OPTIONS.map((h) => {
                const active = hours === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={`h-11 rounded-2xl font-extrabold text-sm transition-all flex flex-col items-center justify-center active:scale-95 ${
                      active
                        ? 'bg-[#007bb9] text-white shadow-md ring-2 ring-[#007bb9]/20 hover:bg-[#006194]'
                        : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <span>+{h}h</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comparativo de Horários e Valor Adicional */}
          <div className="p-4 bg-gradient-to-br from-amber-50/70 to-amber-100/40 dark:from-amber-950/30 dark:to-slate-900 rounded-3xl border border-amber-200/80 dark:border-amber-800/40 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Saída Prevista Anterior:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {currentExpected.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-[#007bb9] dark:text-sky-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Nova Saída Prevista:
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-800/50 shadow-2xs">
                {newExpected.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Valor Adicional a Cobrar:</span>
              <span className="text-lg font-black text-[#007bb9] dark:text-sky-400">
                +{formatCurrency(extraAmount)}
              </span>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="extNotes" className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Motivo / Observações (opcional)
            </Label>
            <Textarea
              id="extNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Hóspede solicitou mais tempo na receção..."
              rows={2}
              className="resize-none text-base sm:text-xs rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-visible:ring-[#007bb9]"
            />
          </div>
          </div>

          <DialogFooter className="px-6 sm:px-7 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0 flex flex-col sm:flex-row gap-2.5 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto h-11 rounded-full border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 font-semibold px-5"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto h-11 rounded-full font-extrabold bg-[#007bb9] hover:bg-[#006194] text-white shadow-md shadow-blue-500/20 px-6 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              disabled={loading}
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? 'A Prorrogar...' : `Adicionar +${hours}h (${formatCurrency(extraAmount)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
