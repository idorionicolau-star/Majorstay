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
import { LogOut, Clock, AlertTriangle, Sparkles, CheckCircle2, DollarSign, CreditCard, MessageCircle } from 'lucide-react';
import { buildStayReceiptWhatsAppMessage, openWhatsApp } from '@/lib/whatsapp';
import { useInventory } from '@/context/inventory-context';
import { formatCurrency } from '@/lib/utils';
import type { Stay, Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';
import { calculateStayPricing, formatStayDuration, normalizeDate, totalContractedHours } from '@/lib/hospitality-calc';

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
  const { companyData } = useInventory();

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
  const contractedHours = totalContractedHours(stay);

  // Cálculo prévio no cliente (o servidor fará a validação final oficial)
  const pricing = calculateStayPricing({
    checkInAt: checkInDate,
    checkOutAt: now,
    contractedHours,
    ratePerHour,
    graceMinutes: 10,
    consumptions: stay.consumptions || [],
  });

  const previousPaid = Number(stay.totalAmountPaid) || 0;
  const balanceToPay = Math.max(0, pricing.totalAmountDue - previousPaid);


  const handleSendWhatsAppReceipt = () => {
    if (!stay) return;
    const simulatedStay: Stay = {
      ...stay,
      checkOutAt: new Date(),
      billedHours: pricing.billedHours,
      totalAmountPaid: pricing.totalAmountDue,
      paymentMethod,
    };
    const msg = buildStayReceiptWhatsAppMessage(simulatedStay, room, companyData?.name);
    openWhatsApp(stay.clientPhone || '', msg);
  };
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
      <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[536px] overflow-hidden p-0 rounded-3xl bg-white dark:bg-[#191E25] border border-blue-100/90 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100">
        {/* Top Fresh Pastel Accent Gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a] shrink-0" />

        <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 shrink-0 flex flex-row items-center justify-between space-y-0 text-left border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Check-out & Fecho de Conta
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Liquidação oficial de estadia e consumos de bar
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 px-6 sm:px-7 py-3 space-y-4">
          {/* Cabeçalho do Quarto */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-xs">
            <div>
              <p className="font-extrabold text-base text-slate-900 dark:text-white">
                {stay.roomName || room?.name || 'Quarto'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Hóspede: <strong className="text-slate-800 dark:text-slate-200">{stay.clientName || 'Particular'}</strong>
                {stay.clientPhone ? ` (${stay.clientPhone})` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tarifa Aplicada</span>
              <span className="font-black text-sm text-[#007bb9] dark:text-sky-400">{formatCurrency(ratePerHour)}/h</span>
            </div>
          </div>

          {/* Resumo da Permanência */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Check-in:</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {checkInDate.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Saída (Agora):</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {now.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Tempo Decorrido:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatStayDuration(pricing.durationMinutes)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Horas Contratadas:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {contractedHours} {contractedHours === 1 ? 'hora' : 'horas'}
                </span>
              </div>
            </div>

            {/* Alerta de Tempo Excedido */}
            {pricing.isOvertime ? (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Tempo Excedido (+{pricing.overtimeHours}h adicional)</p>
                  <p className="text-[11px] text-rose-600/90 mt-0.5">
                    Regra oficial: Hora iniciada conta como hora inteira. Serão faturadas <strong>{pricing.billedHours} horas</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Estadia dentro da compensação acordada de 10 min ({pricing.billedHours}h faturada).</span>
              </div>
            )}
          </div>

          {/* Bloco de Valor Final (Estadia + Consumos de Bar) */}
          <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-blue-950/40 dark:to-slate-900 border-2 border-blue-200/90 dark:border-blue-900/60 rounded-3xl space-y-2 shadow-card">
            {pricing.consumptionsAmountDue > 0 ? (
              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-b border-blue-200/60 dark:border-slate-800 pb-2">
                <div className="flex justify-between">
                  <span>Horas de Quarto ({pricing.billedHours}h × {formatCurrency(ratePerHour)}):</span>
                  <span className="font-semibold">{formatCurrency(pricing.stayAmountDue)}</span>
                </div>
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                  <span>Bar & Consumos ({(stay.consumptions || []).length} itens):</span>
                  <span>+{formatCurrency(pricing.consumptionsAmountDue)}</span>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Total Oficial a Cobrar:
              </span>
              <span className="text-3xl font-black text-[#007bb9] dark:text-sky-400">
                {formatCurrency(pricing.totalAmountDue)}
              </span>
            </div>

            {previousPaid > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-blue-200/40 dark:border-slate-800">
                <span>Adiantado no Check-in:</span>
                <span className="font-semibold">{formatCurrency(previousPaid)}</span>
              </div>
            )}

            {balanceToPay > 0 && previousPaid > 0 && (
              <div className="flex items-center justify-between text-sm font-bold text-rose-600 pt-1">
                <span>Saldo a Pagar Agora:</span>
                <span className="text-base font-extrabold">{formatCurrency(balanceToPay)}</span>
              </div>
            )}
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="checkoutPaymentMethod" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              Forma de Pagamento Recebida *
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="checkoutPaymentMethod" className="h-10 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-white dark:bg-[#191E25] border-slate-200 dark:border-slate-800 shadow-xl">
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs font-medium">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Próximo Estado do Quarto */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Próximo Estado do Quarto após Check-out:
            </Label>
            <RadioGroup
              value={roomNextStatus}
              onValueChange={(val: 'cleaning' | 'free') => setRoomNextStatus(val)}
              className="grid grid-cols-2 gap-3"
            >
              <div className={`p-3 rounded-2xl border flex items-center gap-2 cursor-pointer transition-all ${
                roomNextStatus === 'cleaning'
                  ? 'border-sky-300 ring-2 ring-sky-500/20 bg-sky-50/70 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
              }`}>
                <RadioGroupItem value="cleaning" id="cleaning" />
                <Label htmlFor="cleaning" className="cursor-pointer text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                  Em Limpeza
                </Label>
              </div>

              <div className={`p-3 rounded-2xl border flex items-center gap-2 cursor-pointer transition-all ${
                roomNextStatus === 'free'
                  ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
              }`}>
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free" className="cursor-pointer text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Livre Imediato
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="checkoutNotes" className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Notas do Fecho (opcional)
            </Label>
            <Textarea
              id="checkoutNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Chave entregue sem danos; frigobar conferido..."
              rows={2}
              className="resize-none text-base sm:text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-visible:ring-[#007bb9]"
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

            {stay.clientPhone && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSendWhatsAppReceipt}
                disabled={loading}
                className="w-full sm:w-auto h-11 rounded-full border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 font-bold px-6 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                Recibo WhatsApp
              </Button>
            )}

            <Button
              type="submit"
              className="w-full sm:w-auto h-11 rounded-full bg-[#007bb9] hover:bg-[#006194] text-white font-extrabold shadow-md shadow-blue-500/20 px-7 transition-all active:scale-95"
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
