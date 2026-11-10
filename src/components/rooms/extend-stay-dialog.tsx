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
      <DialogContent className="max-w-md rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] text-[#251D18] dark:text-[#F5EFEB] shadow-xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FDF6E8] dark:bg-[#34241B] border border-[#F6E0B5] dark:border-[#523A2C] flex items-center justify-center text-[#C58A2C]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-[#251D18] dark:text-[#F5EFEB]">
                Prorrogar Estadia
              </DialogTitle>
              <p className="text-xs text-[#827568] dark:text-[#B0A294]">
                Adicione mais horas de permanência ao hóspede
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Identificação do Quarto e Hóspede */}
          <div className="p-3.5 bg-[#F8F5EE] dark:bg-[#261E1A] rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[#251D18] dark:text-[#F5EFEB]">
                {stay.roomName || room?.name || 'Quarto'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FDF6E8] dark:bg-[#34241B] text-[#C58A2C] border border-[#F6E0B5] dark:border-[#523A2C] font-semibold flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                {stay.clientName || 'Hóspede Particular'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#827568] dark:text-[#B0A294] pt-1 border-t border-[#EAE3D6] dark:border-[#332720]">
              <span>Tarifa horária acordada:</span>
              <strong className="text-[#251D18] dark:text-[#F5EFEB]">{formatCurrency(ratePerHour)}/hora</strong>
            </div>
          </div>

          {/* Seleção de Horas Extras */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
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
                    className={`h-11 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center ${
                      active
                        ? 'bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] text-white shadow-md shadow-[#C58A2C]/25 border-transparent'
                        : 'border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] text-[#5C5346] dark:text-[#D4C8B8] hover:bg-[#F2ECE1] dark:hover:bg-[#2A211B]'
                    }`}
                  >
                    <span>+{h}h</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comparativo de Horários e Valor Adicional */}
          <div className="p-4 bg-[#FDF6E8]/70 dark:bg-[#1E242D] rounded-2xl border border-[#F6E0B5] dark:border-[#4A382C] space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#827568] dark:text-[#B0A294]">
              <span>Saída Prevista Anterior:</span>
              <span className="font-semibold text-[#251D18] dark:text-[#F5EFEB]">
                {currentExpected.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-[#C58A2C] dark:text-[#E88C4A]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Nova Saída Prevista:
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-extrabold px-2 py-0.5 rounded-lg bg-white/70 dark:bg-[#111418]/70 border border-[#F6E0B5] dark:border-[#523A2C]">
                {newExpected.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="pt-2 border-t border-[#F6E0B5] dark:border-[#4A382C] flex items-center justify-between">
              <span className="text-xs text-[#827568] dark:text-[#B0A294]">Valor Adicional a Cobrar:</span>
              <span className="text-base font-extrabold text-[#C58A2C] dark:text-[#E88C4A]">
                +{formatCurrency(extraAmount)}
              </span>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="extNotes" className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
              Motivo / Observações (opcional)
            </Label>
            <Textarea
              id="extNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Hóspede solicitou mais tempo na receção..."
              rows={2}
              className="resize-none text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-11 rounded-xl border-[#E5DFD6] dark:border-[#2C3440] text-[#5C5346] dark:text-[#D4C8B8] hover:bg-[#F2ECE1] dark:hover:bg-[#2A211B]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl font-bold bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] hover:from-[#A87019] hover:to-[#B55E22] text-white shadow-md shadow-[#C58A2C]/20 transition-all flex items-center gap-1.5"
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
