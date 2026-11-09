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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LogOut, Clock, AlertTriangle, Sparkles, CheckCircle2, DollarSign, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Stay, Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';
import { calculateStayPricing, formatStayDuration, normalizeDate } from '@/lib/hospitality-calc';

interface CheckOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stay: Stay | null;
  room: Room | null;
}

const PAYMENT_METHODS = [
  { id: 'Dinheiro', label: 'Dinheiro (Numerário)' },
  { id: 'M-Pesa', label: 'M-Pesa (Vodacom)' },
  { id: 'E-Mola', label: 'E-Mola (Movitel)' },
  { id: 'Ponto24', label: 'Ponto24' },
  { id: 'Cartão / POS', label: 'Cartão / TPA' },
  { id: 'Transferência', label: 'Transferência Bancária' },
];

export function CheckOutDialog({ open, onOpenChange, stay, room }: CheckOutDialogProps) {
  const { checkOutStay } = useRooms();

  const [paymentMethod, setPaymentMethod] = useState<string>('Dinheiro');
  const [roomNextStatus, setRoomNextStatus] = useState<'cleaning' | 'free'>('cleaning');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  // Atualizar o relógio a cada 10 segundos enquanto o diálogo estiver aberto
  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, [open]);

  if (!stay) return null;

  const checkInDate = normalizeDate(stay.checkInAt);
  const ratePerHour = stay.ratePerHourApplied || room?.ratePerHour || 0;
  const contractedHours = Number(stay.contractedHours) || 1;

  // Cálculo prévio no cliente (o servidor fará a validação final oficial)
  const pricing = calculateStayPricing({
    checkInAt: checkInDate,
    checkOutAt: now,
    contractedHours,
    ratePerHour,
    graceMinutes: 2,
  });

  const previousPaid = Number(stay.totalAmountPaid) || 0;
  const balanceToPay = Math.max(0, pricing.totalAmountDue - previousPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stay.id) return;

    try {
      setLoading(true);
      await checkOutStay(stay.id, {
        amountPaid: pricing.totalAmountDue,
        paymentMethod,
        roomNextStatus,
        notes: notes.trim(),
      });
      onOpenChange(false);
      setNotes('');
    } catch (err: any) {
      console.error('Erro no checkout:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao efetuar check-out',
        description: err.message || 'Ocorreu uma falha ao encerrar a estadia.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <LogOut className="h-6 w-6 text-rose-600" />
            Check-out & Fecho de Conta
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Cabeçalho do Quarto */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {stay.roomName || room?.name || 'Quarto'}
              </p>
              <p className="text-xs text-slate-500">
                Hóspede: <strong>{stay.clientName || 'Particular'}</strong>
                {stay.clientPhone ? ` (${stay.clientPhone})` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Tarifa Aplicada</span>
              <span className="font-semibold text-sm">{formatCurrency(ratePerHour)}/h</span>
            </div>
          </div>

          {/* Resumo da Permanência e Regra Anti-Roubo */}
          <div className="p-4 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Hora de Entrada (Check-in):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {checkInDate.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Hora de Saída (Agora):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {now.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Tempo Decorrido:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatStayDuration(pricing.durationMinutes)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Horas Contratadas:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {contractedHours} {contractedHours === 1 ? 'hora' : 'horas'}
                </span>
              </div>
            </div>

            {/* Alerta de Tempo Excedido e Regra de Faturação */}
            {pricing.isOvertime ? (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Tempo Excedido (+{pricing.overtimeHours}h adicional)</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400">
                    Regra oficial: Hora começada conta como hora inteira. Serão faturadas <strong>{pricing.billedHours} horas</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Estadia dentro da tolerância acordada ({pricing.billedHours}h faturada).</span>
              </div>
            )}
          </div>

          {/* Bloco de Valor Final */}
          <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 border-2 border-emerald-500/40 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Total Oficial a Cobrar ({pricing.billedHours}h × {formatCurrency(ratePerHour)}):
              </span>
              <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(pricing.totalAmountDue)}
              </span>
            </div>

            {previousPaid > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-emerald-500/20">
                <span>Já adiantado na entrada:</span>
                <span className="font-semibold">{formatCurrency(previousPaid)}</span>
              </div>
            )}

            {balanceToPay > 0 && previousPaid > 0 && (
              <div className="flex items-center justify-between text-sm font-bold text-rose-600 pt-1">
                <span>Saldo adicional a receber agora:</span>
                <span className="text-base">{formatCurrency(balanceToPay)}</span>
              </div>
            )}
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="checkoutPaymentMethod" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              Forma de Pagamento Recebida *
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="checkoutPaymentMethod" className="h-10">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Próximo Estado do Quarto */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Próximo Estado do Quarto após Check-out:
            </Label>
            <RadioGroup
              value={roomNextStatus}
              onValueChange={(val: 'cleaning' | 'free') => setRoomNextStatus(val)}
              className="grid grid-cols-2 gap-3"
            >
              <div className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                roomNextStatus === 'cleaning'
                  ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                  : 'border-slate-200 dark:border-slate-800'
              }`}>
                <RadioGroupItem value="cleaning" id="cleaning" />
                <Label htmlFor="cleaning" className="cursor-pointer text-xs font-medium flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Em Limpeza (Recomendado)
                </Label>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                roomNextStatus === 'free'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800'
              }`}>
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free" className="cursor-pointer text-xs font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Livre Imediatamente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="checkoutNotes" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Notas do Fecho (opcional)
            </Label>
            <Textarea
              id="checkoutNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Chave entregue sem danos; frigobar conferido..."
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
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              disabled={loading}
            >
              {loading ? 'A Concluir...' : `Concluir Check-out (${formatCurrency(pricing.totalAmountDue)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
