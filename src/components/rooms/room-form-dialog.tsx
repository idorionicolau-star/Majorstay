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
import { BedDouble, Sparkles, Clock, DollarSign } from 'lucide-react';
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
    if (ratePerHour <= 0) {
      toast({ variant: 'destructive', title: 'Tarifa inválida', description: 'O valor por hora deve ser superior a zero.' });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <BedDouble className="h-6 w-6 text-primary" />
            {roomToEdit ? 'Editar Quarto' : 'Novo Quarto no Alojamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nome / Número */}
          <div className="space-y-1">
            <Label htmlFor="roomName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nome ou Número do Quarto *
            </Label>
            <Input
              id="roomName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Quarto 101 ou Suíte Presidencial"
              className="h-10"
              required
            />
          </div>

          {/* Tipo de Quarto */}
          <div className="space-y-1">
            <Label htmlFor="roomType" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Categoria / Tipo
            </Label>
            <Select value={type} onValueChange={(val: RoomType) => setType(val)}>
              <SelectTrigger id="roomType" className="h-10">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tarifa por Hora (MT) e Mínimo de Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ratePerHour" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tarifa Horária (MT) *
              </Label>
              <Input
                id="ratePerHour"
                type="number"
                min="1"
                step="50"
                value={ratePerHour}
                onChange={(e) => setRatePerHour(Number(e.target.value))}
                placeholder="300"
                className="h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="minHours" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mínimo de Horas
              </Label>
              <Input
                id="minHours"
                type="number"
                min="1"
                max="24"
                value={minimumHours}
                onChange={(e) => setMinimumHours(Number(e.target.value))}
                className="h-10"
              />
            </div>
          </div>

          {/* Tempo de Limpeza Estimado */}
          <div className="space-y-1">
            <Label htmlFor="cleaningMin" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tempo Estimado de Limpeza (minutos)
            </Label>
            <Input
              id="cleaningMin"
              type="number"
              min="5"
              step="5"
              value={cleaningDurationMinutes}
              onChange={(e) => setCleaningDurationMinutes(Number(e.target.value))}
              placeholder="15"
              className="h-10"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="roomNotes" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Observações / Comodidades (opcional)
            </Label>
            <Textarea
              id="roomNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Ar condicionado, frigobar, vista para o jardim..."
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
              className="font-semibold"
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
