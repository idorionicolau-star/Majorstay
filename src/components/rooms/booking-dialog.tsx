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
import { Calendar, Clock, User, Phone, Coins, MessageCircle, BedDouble } from 'lucide-react';
import type { Room, Booking } from '@/lib/types';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';
import { buildBookingWhatsAppMessage, openWhatsApp } from '@/lib/whatsapp';
import { cn, formatCurrency } from '@/lib/utils';

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
        roomId: selectedRoomId && selectedRoomId !== 'auto' ? selectedRoomId : '',
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
      <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[536px] overflow-hidden p-0 rounded-3xl bg-white dark:bg-[#191E25] border border-blue-100/90 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100">
        {/* Faixa superior pastel nobre */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a] shrink-0" />

        <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 shrink-0 flex flex-row items-center justify-between space-y-0 text-left border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Nova Reserva Antecipada
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Registo de reservas por chamada ou WhatsApp com envio direto
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 sm:px-7 py-3 space-y-4">
          {/* Dados do Hóspede - Ícones nas labels para NUNCA sobrepor o texto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="resClientName" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Nome do Hóspede <span className="text-[#fd761a]">*</span>
              </Label>
              <Input
                id="resClientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Carlos Mondlane"
                className="text-base sm:text-xs font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 h-10 focus-visible:ring-[#007bb9]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resClientPhone" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Contacto / WhatsApp <span className="text-[#fd761a]">*</span>
              </Label>
              <Input
                id="resClientPhone"
                inputMode="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="84 / 82 / 85 / 86..."
                className="text-base sm:text-xs font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 h-10 focus-visible:ring-[#007bb9]"
                required
              />
            </div>
          </div>

          {/* Quarto e Data de Entrada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <BedDouble className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Quarto Pretendido
              </Label>
              <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                <SelectTrigger className="h-10 text-xs font-medium rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Selecione o quarto..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-xl">
                  <SelectItem value="auto" className="text-xs font-medium">
                    A atribuir na chegada
                  </SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs font-medium">
                      {r.name} ({r.type || 'Standard'}) — {formatCurrency(r.ratePerHour)}/h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resCheckInDate" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Data e Chegada Prevista <span className="text-[#fd761a]">*</span>
              </Label>
              <Input
                id="resCheckInDate"
                type="datetime-local"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="text-xs font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 h-10 focus-visible:ring-[#007bb9]"
                required
              />
            </div>
          </div>

          {/* Duração Pretendida - Pílulas táteis Stitch 3 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                    className={cn(
                      'py-2.5 px-2 text-xs font-bold rounded-2xl transition-all flex items-center justify-center active:scale-95 shadow-xs',
                      active
                        ? 'bg-[#007bb9] text-white shadow-md ring-2 ring-[#007bb9]/20 hover:bg-[#006194]'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-200 hover:bg-blue-50/40'
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sinal / Depósito Antecipado & Estimativa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
            <div className="space-y-1.5">
              <Label htmlFor="resDeposit" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Sinal / Depósito Pago (MT)
              </Label>
              <Input
                id="resDeposit"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={depositAmount || ''}
                onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                placeholder="0 (sem sinal)"
                className="text-base sm:text-xs font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 h-10 focus-visible:ring-[#007bb9]"
              />
            </div>

            {/* Resumo da Reserva com Estilo Dourado/Azul Stitch */}
            <div className="p-3.5 bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-950/30 dark:to-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 flex flex-col justify-center text-xs shadow-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-medium">
                <span>Estimativa Total:</span>
                <strong className="text-base font-extrabold text-[#007bb9] dark:text-sky-400">
                  {formatCurrency(estimatedTotal)}
                </strong>
              </div>
              {depositAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 pt-1 border-t border-amber-200/50 dark:border-amber-900/40 mt-1 font-bold">
                  <span>Sinal Adiantado:</span>
                  <span>-{formatCurrency(depositAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="resNotes" className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Notas / Pedidos Especiais (opcional)
            </Label>
            <Textarea
              id="resNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Hóspede ligou a pedir quarto silencioso ou cama extra..."
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
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="w-full sm:w-auto h-11 rounded-full border border-blue-200 dark:border-blue-900/60 text-[#007bb9] dark:text-sky-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold px-6 shadow-xs"
          >
            Salvar Reserva
          </Button>

          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading}
            className="w-full sm:w-auto h-11 rounded-full font-bold bg-[#15803d] hover:bg-[#166534] text-white shadow-md shadow-emerald-500/20 px-6 flex items-center justify-center gap-2 active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            Salvar & WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
