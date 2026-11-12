'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BedDouble, Sparkles, Clock, Coins } from 'lucide-react';
import type { Room, RoomType } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomToEdit?: Room | null;
}

const ROOM_TYPES: { id: RoomType; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'suite', label: 'Suíte' },
  { id: 'luxo', label: 'Suíte Luxo' },
  { id: 'executivo', label: 'Executivo' },
  { id: 'casal', label: 'Casal' },
  { id: 'solteiro', label: 'Solteiro' },
];

export function RoomFormDialog({ open, onOpenChange, roomToEdit }: RoomFormDialogProps) {
  const { addRoom, updateRoom } = useRooms();

  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('standard');
  const [ratePerHour, setRatePerHour] = useState<number>(300);
  const [minimumHours, setMinimumHours] = useState<number>(1);
  const [cleaningDurationMinutes, setCleaningDurationMinutes] = useState<number>(15);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roomToEdit) {
      setName(roomToEdit.name || '');
      setType((roomToEdit.type as RoomType) || 'standard');
      setRatePerHour(roomToEdit.ratePerHour || 300);
      setMinimumHours(roomToEdit.minimumHours || 1);
      setCleaningDurationMinutes(roomToEdit.cleaningDurationMinutes || 15);
      setNotes(roomToEdit.notes || '');
    } else {
      setName('');
      setType('standard');
      setRatePerHour(300);
      setMinimumHours(1);
      setCleaningDurationMinutes(15);
      setNotes('');
    }
  }, [roomToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Nome do quarto é obrigatório' });
      return;
    }
    if (ratePerHour < 0 || isNaN(ratePerHour)) {
      toast({ variant: 'destructive', title: 'Tarifa inválida', description: 'O valor por hora não pode ser negativo.' });
      return;
    }

    try {
      setLoading(true);
      if (roomToEdit) {
        await updateRoom(roomToEdit.id, {
          name: name.trim(),
          type,
          ratePerHour,
          minimumHours: Math.max(1, minimumHours),
          cleaningDurationMinutes: Math.max(1, cleaningDurationMinutes || 15),
          notes: notes.trim(),
        });
      } else {
        await addRoom({
          name: name.trim(),
          type,
          ratePerHour,
          minimumHours: Math.max(1, minimumHours),
          cleaningDurationMinutes: Math.max(1, cleaningDurationMinutes || 15),
          active: true,
          notes: notes.trim(),
        });
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao guardar quarto:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao guardar',
        description: err.message || 'Falha ao salvar quarto.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-md overflow-hidden p-0 rounded-3xl bg-white dark:bg-[#191E25] border border-blue-100/90 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100">
        {/* Top Fresh Pastel Accent Gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a] shrink-0" />

        <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 shrink-0 flex flex-row items-center justify-between space-y-0 text-left border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
              <BedDouble className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                {roomToEdit ? 'Editar Quarto' : 'Novo Quarto no Alojamento'}
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure o nome, categoria e tarifa horária do alojamento
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 px-6 sm:px-7 py-3 space-y-4">
          {/* Nome / Número */}
          <div className="space-y-1.5">
            <Label htmlFor="roomName" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <BedDouble className="w-3.5 h-3.5 text-slate-400" />
              Nome ou Número do Quarto <span className="text-[#fd761a]">*</span>
            </Label>
            <Input
              id="roomName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Quarto 101 ou Suíte Presidencial"
              className="h-10 text-base sm:text-xs font-semibold rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 focus-visible:ring-[#007bb9]"
              required
            />
          </div>

          {/* Tipo de Quarto */}
          <div className="space-y-1.5">
            <Label htmlFor="roomType" className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Categoria / Tipo
            </Label>
            <Select value={type} onValueChange={(val: RoomType) => setType(val)}>
              <SelectTrigger id="roomType" className="h-10 text-xs rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-xl">
                {ROOM_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs font-medium focus:bg-blue-50 focus:text-[#007bb9]">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tarifa por Hora (MT) e Mínimo de Horas */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="ratePerHour" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                Tarifa Horária (MT) <span className="text-[#fd761a]">*</span>
              </Label>
              <Input
                id="ratePerHour"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={ratePerHour}
                onChange={(e) => setRatePerHour(Number(e.target.value))}
                placeholder="300"
                className="h-10 text-base sm:text-xs font-semibold rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 focus-visible:ring-[#007bb9]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minHours" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Mínimo de Horas
              </Label>
              <Input
                id="minHours"
                type="number"
                inputMode="numeric"
                min="1"
                max="24"
                value={minimumHours}
                onChange={(e) => setMinimumHours(Number(e.target.value))}
                className="h-10 text-base sm:text-xs font-semibold rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 focus-visible:ring-[#007bb9]"
              />
            </div>
          </div>

          {/* Tempo de Limpeza Estimado & Alerta aos Administradores */}
          <div className="space-y-1.5">
            <Label htmlFor="cleaningMin" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              Tempo Limite de Limpeza (minutos)
            </Label>
            <Input
              id="cleaningMin"
              type="number"
              inputMode="numeric"
              min="1"
              step="any"
              value={cleaningDurationMinutes}
              onChange={(e) => setCleaningDurationMinutes(Number(e.target.value))}
              placeholder="15"
              className="h-10 text-base sm:text-xs font-semibold rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 focus-visible:ring-[#007bb9]"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Alerta automático: a administração é notificada se a higienização exceder este tempo (padrão 15 min).
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="roomNotes" className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Observações / Comodidades (opcional)
            </Label>
            <Textarea
              id="roomNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Ar condicionado, frigobar, vista para o jardim..."
              rows={2}
              className="resize-none text-base sm:text-xs rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-visible:ring-[#007bb9]"
            />
          </div>
          </div>

          <DialogFooter className="px-6 sm:px-7 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 justify-end">
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
              className="w-full sm:w-auto h-11 rounded-full font-extrabold bg-[#007bb9] hover:bg-[#006194] text-white shadow-md shadow-blue-500/20 px-6 active:scale-95 transition-all"
              disabled={loading}
            >
              {loading ? 'A Guardar...' : roomToEdit ? 'Salvar Alterações' : 'Criar Quarto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
