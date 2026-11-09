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
import { Calendar, Clock, User, Phone, Coins, Sparkles, MessageCircle } from 'lucide-react';
import type { Room, Booking } from '@/lib/types';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';
import { buildBookingWhatsAppMessage, openWhatsApp } from '@/lib/whatsapp';

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  onSaveBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Promise<Booking | void>;
}

const DURATION_PRESETS = [
  { hours: 1, label: '1 hora' },
  { hours: 2, label: '2 horas' },
  { hours: 3, label: '3 horas' },
  { hours: 4, label: '4 horas' },
  { hours: 12, label: 'Pernoita (12h)', isOvernight: true },
  { hours: 24, label: 'Diária (24h)' },
];

export function BookingDialog({
  open,
  onOpenChange,
  rooms,
  onSaveBooking,
}: BookingDialogProps) {
  const { user, companyData } = useInventory();

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('auto');
  const [checkInDate, setCheckInDate] = useState(() => {
    // Padrão: daqui a 2 horas
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16); // Formato YYYY-MM-DDTHH:mm
  });
  const [durationHours, setDurationHours] = useState<number>(2);
  const [isOvernight, setIsOvernight] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const ratePerHour = selectedRoom?.ratePerHour || 300;
  const estimatedTotal = durationHours * ratePerHour;

  const handlePresetSelect = (preset: { hours: number; isOvernight?: boolean }) => {
    setDurationHours(preset.hours);
    setIsOvernight(!!preset.isOvernight);
  };

  const handleSave = async (sendWhatsApp: boolean) => {
    if (!clientName.trim()) {
      toast({ variant: 'destructive', title: 'Indique o nome do hóspede' });
      return;
    }
    if (!clientPhone.trim()) {
      toast({ variant: 'destructive', title: 'Indique o contacto / WhatsApp do hóspede' });
      return;
    }

    try {
      setLoading(true);
      const bookingData: Omit<Booking, 'id' | 'createdAt'> = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        roomId: selectedRoomId === 'auto' ? undefined : selectedRoomId,
        roomName: selectedRoom ? selectedRoom.name : 'A atribuir na chegada',
        checkInDate: new Date(checkInDate),
        durationHours,
        isOvernight,
        depositAmount: Number(depositAmount) || 0,
        totalEstimated: estimatedTotal,
        status: 'confirmed',
        notes: notes.trim(),
        createdBy: user?.id || 'admin',
        createdByName: user?.username || 'Recepção',
      };

      const saved = await onSaveBooking(bookingData);

      toast({
        title: 'Reserva registada com sucesso!',
        description: `Agendada para ${bookingData.roomName} em nome de ${bookingData.clientName}.`,
      });

      if (sendWhatsApp) {
        const fullBooking: Booking = {
          ...bookingData,
          id: (saved as any)?.id || `book-${Date.now()}`,
          createdAt: new Date(),
        };
        const msg = buildBookingWhatsAppMessage(fullBooking, companyData?.name);
        openWhatsApp(bookingData.clientPhone, msg);
      }

      onOpenChange(false);
      // Reset
      setClientName('');
      setClientPhone('');
      setSelectedRoomId('auto');
      setDepositAmount(0);
      setNotes('');
    } catch (err: any) {
      console.error('Erro ao guardar reserva:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao registar reserva',
        description: err.message || 'Falha ao guardar os dados da reserva.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] text-[#251D18] dark:text-[#F5EFEB] shadow-xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF0E6] dark:bg-[#34241B] border border-[#F0D5C0] dark:border-[#523A2C] flex items-center justify-center text-[#BA5A1A]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-[#251D18] dark:text-[#F5EFEB]">
                Nova Reserva Antecipada
              </DialogTitle>
              <p className="text-xs text-[#827568] dark:text-[#B0A294]">
                Registe reservas por chamada ou WhatsApp com envio de confirmação direta
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Dados do Hóspede */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
                Nome do Hóspede *
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Carlos Sitoe"
                  className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] focus-visible:ring-[#BA5A1A]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
                Contacto / WhatsApp *
              </Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
                <Input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="84 / 82 / 85 / 86..."
                  className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] focus-visible:ring-[#BA5A1A]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Quarto e Data de Entrada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
                Quarto Pretendido
              </Label>
              <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714]">
                  <SelectValue placeholder="Selecione o quarto..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915]">
                  <SelectItem value="auto" className="text-xs font-medium">
                    A atribuir na chegada
                  </SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs font-medium">
                      {r.name} ({r.type || 'Standard'}) — {r.ratePerHour} MT/h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
                Data e Hora de Chegada Prevista *
              </Label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
                <Input
                  type="datetime-local"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] focus-visible:ring-[#BA5A1A]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Duração Pretendida */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
              Permanência Contratada
            </Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DURATION_PRESETS.map((p) => {
                const active = durationHours === p.hours && isOvernight === !!p.isOvernight;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`h-9 px-2 text-xs rounded-xl font-bold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#BA5A1A] to-[#C86A2B] text-white shadow-sm'
                        : 'border border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] text-[#5C5346] dark:text-[#D4C8B8] hover:bg-[#F2ECE1] dark:hover:bg-[#2A211B]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sinal / Depósito Antecipado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
                Sinal / Depósito Pago (MT)
              </Label>
              <div className="relative">
                <Coins className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={depositAmount || ''}
                  onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                  placeholder="0 (sem sinal)"
                  className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] focus-visible:ring-[#BA5A1A]"
                />
              </div>
            </div>

            {/* Resumo da Reserva */}
            <div className="p-3 bg-[#FAF0E6]/70 dark:bg-[#2A201A] rounded-2xl border border-[#F0D5C0] dark:border-[#4A382C] flex flex-col justify-center text-xs">
              <div className="flex justify-between items-center text-[#827568] dark:text-[#B0A294]">
                <span>Estimativa Total:</span>
                <strong className="text-sm text-[#BA5A1A] dark:text-[#E88C4A]">
                  {estimatedTotal} MT
                </strong>
              </div>
              {depositAmount > 0 && (
                <div className="flex justify-between items-center text-[#245D3B] dark:text-[#64C28D] pt-1">
                  <span>Sinal Pago:</span>
                  <span className="font-bold">-{depositAmount} MT</span>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#5C5346] dark:text-[#D4C8B8]">
              Notas / Pedidos Especiais (opcional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Hóspede ligou a pedir quarto silencioso com vista para a piscina..."
              rows={2}
              className="resize-none text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] focus-visible:ring-[#BA5A1A]"
            />
          </div>
        </div>

        <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto h-11 rounded-xl border-[#E5DFD6] dark:border-[#382D26] text-[#5C5346] dark:text-[#D4C8B8] hover:bg-[#F2ECE1] dark:hover:bg-[#2A211B]"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="w-full sm:w-auto h-11 rounded-xl border-[#E5DFD6] dark:border-[#382D26] font-semibold"
          >
            Salvar Reserva
          </Button>

          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading}
            className="w-full sm:w-auto h-11 rounded-xl font-bold bg-[#245D3B] hover:bg-[#1C4A2F] text-white shadow-md shadow-[#245D3B]/20 flex items-center justify-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            Salvar & WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
