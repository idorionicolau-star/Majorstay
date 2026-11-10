'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { BedDouble, Clock, User, Phone, CreditCard, Sparkles, Check, Moon } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRoomId?: string | null;
  initialGuestName?: string;
  initialGuestPhone?: string;
  initialHours?: number;
}

const PRESET_HOURS = [
  { label: '1 hora', hours: 1 },
  { label: '2 horas', hours: 2 },
  { label: '3 horas', hours: 3 },
  { label: '4 horas', hours: 4 },
  { label: '6 horas', hours: 6 },
  { label: '12 horas', hours: 12 },
  { label: '24h / Pernoite', hours: 24, isNight: true },
];

const QUICK_PAYMENTS = [
  { id: 'Dinheiro', label: '💵 Dinheiro' },
  { id: 'M-Pesa / E-Mola', label: '📱 M-Pesa / E-Mola' },
  { id: 'POS / Cartão', label: '💳 POS / Cartão' },
];

export function CheckInDialog({ open, onOpenChange, preselectedRoomId, initialGuestName, initialGuestPhone, initialHours }: CheckInDialogProps) {
  const { rooms, checkInStay } = useRooms();

  const freeRooms = rooms.filter((r) => r.active && (r.status === 'free' || r.id === preselectedRoomId));

  const [roomId, setRoomId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('Hóspede Particular');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientDoc, setClientDoc] = useState<string>('');
  const [contractedHours, setContractedHours] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<string>('Dinheiro');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Selecionar o quarto inicial
  useEffect(() => {
    if (open) {
      if (initialGuestName) setClientName(initialGuestName);
      if (initialGuestPhone) setClientPhone(initialGuestPhone);
      if (initialHours) setContractedHours(initialHours);
    }
  }, [open, initialGuestName, initialGuestPhone, initialHours]);

  useEffect(() => {
    if (preselectedRoomId) {
      setRoomId(preselectedRoomId);
      const selected = rooms.find((r) => r.id === preselectedRoomId);
      if (selected?.minimumHours && selected.minimumHours > 1) {
        setContractedHours(selected.minimumHours);
      }
    } else if (freeRooms.length > 0 && !roomId) {
      setRoomId(freeRooms[0].id);
      if (freeRooms[0].minimumHours && freeRooms[0].minimumHours > 1) {
        setContractedHours(freeRooms[0].minimumHours);
      }
    }
  }, [preselectedRoomId, rooms, freeRooms, roomId]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const ratePerHour = selectedRoom?.ratePerHour || 0;
  const totalAmount = contractedHours * ratePerHour;

  const expectedCheckOutFormatted = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + contractedHours);
    return d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
  }, [contractedHours]);

  const handleRoomChange = (newRoomId: string) => {
    setRoomId(newRoomId);
    const room = rooms.find((r) => r.id === newRoomId);
    if (room?.minimumHours && contractedHours < room.minimumHours) {
      setContractedHours(room.minimumHours);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) {
      toast({ variant: 'destructive', title: 'Selecione um quarto' });
      return;
    }
    if (contractedHours < 1) {
      toast({ variant: 'destructive', title: 'Horas inválidas', description: 'O mínimo é 1 hora.' });
      return;
    }

    try {
      setLoading(true);
      await checkInStay({
        roomId,
        roomName: selectedRoom?.name,
        clientName: clientName.trim() || 'Hóspede Particular',
        clientPhone: clientPhone.trim(),
        clientDoc: clientDoc.trim(),
        contractedHours,
        ratePerHour,
        paymentMethod,
        notes: notes.trim(),
      });
      onOpenChange(false);
      setClientName('Hóspede Particular');
      setClientPhone('');
      setClientDoc('');
      setContractedHours(selectedRoom?.minimumHours || 1);
      setNotes('');
    } catch (err: any) {
      console.error('Erro no check-in:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao registar check-in',
        description: err.message || 'Verifique a ligação e tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[536px] max-h-[94vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#191E25] border border-blue-100/90 dark:border-slate-800 shadow-2xl p-0 overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Top Fresh Pastel Accent Gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a]" />

        {/* Modal Header */}
        <DialogHeader className="px-7 pt-5 pb-3 flex flex-row items-center justify-between space-y-0 text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
              <BedDouble className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                Novo Check-in de Quarto
              </DialogTitle>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-400 mt-0.5">
                Atribuição rápida de acomodação e tarifa horária
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-7 py-2 space-y-4">
          {/* Seleção do Quarto */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="roomSelect" className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide">
                Quarto a Ocupar <span className="text-[#fd761a]">*</span>
              </Label>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e8faf1] dark:bg-emerald-950/60 text-[#00855b] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00855b] dark:bg-emerald-400" /> Disponível
              </span>
            </div>
            <Select value={roomId} onValueChange={handleRoomChange}>
              <SelectTrigger id="roomSelect" className="h-11 rounded-2xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 text-xs sm:text-sm font-semibold">
                <SelectValue placeholder="Selecione um quarto..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#191E25] border-slate-200 dark:border-slate-800 rounded-2xl">
                {freeRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="rounded-xl">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{r.name}</span>
                      <span className="text-xs text-slate-500 font-normal">
                        {formatCurrency(r.ratePerHour)}/hora (mín. {r.minimumHours || 1}h)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoom && (
              <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-[#fd761a]" />
                <span>
                  Tarifa base deste quarto: <strong className="text-slate-800 dark:text-slate-200 font-bold">{formatCurrency(ratePerHour)}/hora</strong>
                </span>
              </div>
            )}
          </div>

          {/* Duração da Estadia (Duration & Cost Card) */}
          <div className="bg-gradient-to-b from-[#f0f8ff]/90 to-[#fdfaf7] dark:from-slate-900/80 dark:to-slate-950/80 border border-blue-100 dark:border-slate-800 rounded-3xl p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Clock className="w-4 h-4 text-[#007bb9] dark:text-sky-400" />
                <span>Duração da Estadia <span className="text-[#fd761a]">*</span></span>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-[#006194] dark:text-sky-300 bg-[#cce5ff] dark:bg-blue-950 px-2.5 py-0.5 rounded-full inline-block">
                  {contractedHours} {contractedHours === 1 ? 'hora' : 'horas'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                  Saída prevista: {expectedCheckOutFormatted}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {PRESET_HOURS.slice(0, 4).map((p) => {
                const active = contractedHours === p.hours;
                return (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setContractedHours(p.hours)}
                    className={cn(
                      "py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center justify-center active:scale-95 shadow-xs",
                      active
                        ? "bg-[#007bb9] text-white shadow-md ring-2 ring-[#007bb9]/20 hover:bg-[#006194]"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-200 hover:bg-blue-50/40"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_HOURS.slice(4).map((p) => {
                const active = contractedHours === p.hours;
                const isNight = p.isNight;
                return (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setContractedHours(p.hours)}
                    className={cn(
                      "py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs",
                      isNight ? "col-span-2" : "col-span-1",
                      active
                        ? "bg-[#007bb9] text-white shadow-md ring-2 ring-[#007bb9]/20 hover:bg-[#006194]"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-200 hover:bg-blue-50/40"
                    )}
                  >
                    {isNight && <Moon className="w-3.5 h-3.5" />}
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-blue-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Valor Inicial a Cobrar:</span>
              <div className="text-right leading-none">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#007bb9] dark:text-sky-400 tracking-tight">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Dados do Hóspede */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="clientName" className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Nome do Hóspede <span className="text-[#fd761a]">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setClientName('Hóspede Particular')}
                  className="text-[11px] text-[#007bb9] dark:text-sky-400 hover:underline font-bold"
                >
                  + Anónimo
                </button>
              </div>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Carlos Mondlane"
                className="text-xs font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-slate-800 px-3.5 py-2.5 h-10"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="clientPhone" className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Contacto Telefónico <span className="text-slate-400 font-normal text-[10px]">(opcional)</span>
                </Label>
              </div>
              <Input
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="84 / 82 / 87... (M-Pesa / Movitel)"
                className="text-xs font-medium rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 h-10"
              />
            </div>
          </div>

          {/* Método de Pagamento Inicial */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              Método de Pagamento Inicial
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_PAYMENTS.map((m) => {
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={cn(
                      "rounded-2xl p-2.5 flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 shadow-xs",
                      isSelected
                        ? "border-2 border-[#007bb9] bg-[#cce5ff]/35 dark:bg-blue-950/60 font-bold text-[#006194] dark:text-sky-300"
                        : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-blue-50/30 text-slate-700 dark:text-slate-200 font-semibold"
                    )}
                  >
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observações / Notas */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Observações <span className="text-slate-400 font-normal text-[10px]">(opcional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pagamento adiantado; cliente solicitou toalhas adicionais..."
              rows={2}
              className="w-full text-xs font-normal bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 resize-none"
            />
          </div>

          {/* Action Footer */}
          <div className="px-7 py-4 bg-slate-50/70 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 -mx-7 -mb-2 mt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !roomId}
              className="px-7 py-2.5 rounded-full bg-[#007bb9] hover:bg-[#006194] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'A Registar...' : `Confirmar Check-in (${formatCurrency(totalAmount)})`}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
