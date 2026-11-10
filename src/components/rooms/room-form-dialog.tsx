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
          cleaningDurationMinutes: Math.max(5, cleaningDurationMinutes),
          notes: notes.trim(),
        });
      } else {
        await addRoom({
          name: name.trim(),
          type,
          ratePerHour,
          minimumHours: Math.max(1, minimumHours),
          cleaningDurationMinutes: Math.max(5, cleaningDurationMinutes),
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
      <DialogContent className="max-w-md rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] text-[#251D18] dark:text-[#F5EFEB] shadow-xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FDF6E8] dark:bg-[#34241B] border border-[#F6E0B5] dark:border-[#523A2C] flex items-center justify-center text-[#C58A2C]">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-[#251D18] dark:text-[#F5EFEB]">
                {roomToEdit ? 'Editar Quarto' : 'Novo Quarto no Alojamento'}
              </DialogTitle>
              <p className="text-xs text-[#827568] dark:text-[#B0A294]">
                Configure o nome, categoria e tarifa horária do alojamento
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nome / Número */}
          <div className="space-y-1.5">
            <Label htmlFor="roomName" className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
              Nome ou Número do Quarto *
            </Label>
            <Input
              id="roomName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Quarto 101 ou Suíte Presidencial"
              className="h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
              required
            />
          </div>

          {/* Tipo de Quarto */}
          <div className="space-y-1.5">
            <Label htmlFor="roomType" className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
              Categoria / Tipo
            </Label>
            <Select value={type} onValueChange={(val: RoomType) => setType(val)}>
              <SelectTrigger id="roomType" className="h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25]">
                {ROOM_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs font-medium focus:bg-[#FDF6E8] focus:text-[#C58A2C]">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tarifa por Hora (MT) e Mínimo de Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ratePerHour" className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
                Tarifa Horária (MT) *
              </Label>
              <div className="relative">
                <Coins className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-[#827568]" />
                <Input
                  id="ratePerHour"
                  type="number"
                  min="0"
                  step="any"
                  value={ratePerHour}
                  onChange={(e) => setRatePerHour(Number(e.target.value))}
                  placeholder="300"
                  className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minHours" className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
                Mínimo de Horas
              </Label>
              <Input
                id="minHours"
                type="number"
                min="1"
                max="24"
                value={minimumHours}
                onChange={(e) => setMinimumHours(Number(e.target.value))}
                className="h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
              />
            </div>
          </div>

          {/* Tempo de Limpeza Estimado */}
          <div className="space-y-1.5">
            <Label htmlFor="cleaningMin" className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
              Tempo Estimado de Limpeza (minutos)
            </Label>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-[#827568]" />
              <Input
                id="cleaningMin"
                type="number"
                min="1"
                step="any"
                value={cleaningDurationMinutes}
                onChange={(e) => setCleaningDurationMinutes(Number(e.target.value))}
                placeholder="15"
                className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="roomNotes" className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
              Observações / Comodidades (opcional)
            </Label>
            <Textarea
              id="roomNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Ar condicionado, frigobar, vista para o jardim..."
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
              className="h-11 rounded-xl font-bold bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] hover:from-[#A87019] hover:to-[#B55E22] text-white shadow-md shadow-[#C58A2C]/20 transition-all"
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
