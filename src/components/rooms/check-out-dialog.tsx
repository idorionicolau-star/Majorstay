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
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[#FFFDF9] dark:bg-[#111418] border-[#E5DFD6] dark:border-[#2C3440] shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-xl font-headline font-bold text-stone-900 dark:text-stone-100">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <LogOut className="h-5 w-5" />
            </div>
            Check-out & Fecho de Conta
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Cabeçalho do Quarto */}
          <div className="p-3.5 bg-[#FAF7F2] dark:bg-[#1E242D] rounded-2xl border border-[#EBE3D5] dark:border-[#382B24] flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-base text-stone-900 dark:text-stone-100">
                {stay.roomName || room?.name || 'Quarto'}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Hóspede: <strong className="text-stone-800 dark:text-stone-200">{stay.clientName || 'Particular'}</strong>
                {stay.clientPhone ? ` (${stay.clientPhone})` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">Tarifa Aplicada</span>
              <span className="font-bold text-sm text-[#C58A2C] dark:text-[#E0852E]">{formatCurrency(ratePerHour)}/h</span>
            </div>
          </div>

          {/* Resumo da Permanência */}
          <div className="p-4 bg-[#FAF7F2] dark:bg-[#1E242D] rounded-2xl border border-[#EBE3D5] dark:border-[#382B24] space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase tracking-wider">Check-in:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                  {checkInDate.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase tracking-wider">Saída (Agora):</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                  {now.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#EBE3D5] dark:border-[#382B24] grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-400 font-medium block">Tempo Decorrido:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {formatStayDuration(pricing.durationMinutes)}
                </span>
              </div>
              <div>
                <span className="text-stone-400 font-medium block">Horas Contratadas:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {contractedHours} {contractedHours === 1 ? 'hora' : 'horas'}
                </span>
              </div>
            </div>

            {/* Alerta de Tempo Excedido */}
            {pricing.isOvertime ? (
              <div className="p-3 rounded-xl bg-[#FDF0EE] dark:bg-[#381616] border border-[#FBD5D0] dark:border-[#5C2323] text-xs text-[#C53030] dark:text-[#FEB2B2] flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-[#C53030] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Tempo Excedido (+{pricing.overtimeHours}h adicional)</p>
                  <p className="text-[11px] text-[#C53030]/80 mt-0.5">
                    Regra oficial: Hora iniciada conta como hora inteira. Serão faturadas <strong>{pricing.billedHours} horas</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-[#EDF6F0] dark:bg-[#1C3023] border border-[#CDE5D5] dark:border-[#284934] text-xs text-[#245D3B] dark:text-[#8CD9A9] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#488C64] shrink-0" />
                <span>Estadia dentro da compensação acordada de 10 min ({pricing.billedHours}h faturada).</span>
              </div>
            )}
          </div>

          {/* Bloco de Valor Final (Estadia + Consumos de Bar) */}
          <div className="p-4 bg-[#FDF6E8]/70 dark:bg-[#282012]/60 border-2 border-[#C58A2C]/30 rounded-2xl space-y-2">
            {pricing.consumptionsAmountDue > 0 ? (
              <div className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300 border-b border-[#C58A2C]/20 pb-2">
                <div className="flex justify-between">
                  <span>Horas de Quarto ({pricing.billedHours}h × {formatCurrency(ratePerHour)}):</span>
                  <span className="font-semibold">{formatCurrency(pricing.stayAmountDue)}</span>
                </div>
                <div className="flex justify-between text-[#DF9E42] font-semibold">
                  <span>Bar & Consumos ({(stay.consumptions || []).length} itens):</span>
                  <span>+{formatCurrency(pricing.consumptionsAmountDue)}</span>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-stone-800 dark:text-stone-200">
                Total Oficial a Cobrar:
              </span>
              <span className="text-2xl font-headline font-black text-[#C58A2C] dark:text-[#E0852E]">
                {formatCurrency(pricing.totalAmountDue)}
              </span>
            </div>

            {previousPaid > 0 && (
              <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-[#C58A2C]/10">
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
            <Label htmlFor="checkoutPaymentMethod" className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5 text-stone-400" />
              Forma de Pagamento Recebida *
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="checkoutPaymentMethod" className="h-10 rounded-xl bg-[#FAF7F2] dark:bg-[#251D18] border-[#E5DFD6] dark:border-[#2C3440]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFDF9] dark:bg-[#111418] border-[#E5DFD6] dark:border-[#2C3440]">
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
            <Label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Próximo Estado do Quarto após Check-out:
            </Label>
            <RadioGroup
              value={roomNextStatus}
              onValueChange={(val: 'cleaning' | 'free') => setRoomNextStatus(val)}
              className="grid grid-cols-2 gap-3"
            >
              <div className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                roomNextStatus === 'cleaning'
                  ? 'border-[#DF9E42] bg-[#FAF4E6] dark:bg-[#322510]'
                  : 'border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25]'
              }`}>
                <RadioGroupItem value="cleaning" id="cleaning" />
                <Label htmlFor="cleaning" className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-stone-800 dark:text-stone-200">
                  <Sparkles className="h-3.5 w-3.5 text-[#DF9E42]" />
                  Em Limpeza (Recomendado)
                </Label>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                roomNextStatus === 'free'
                  ? 'border-[#488C64] bg-[#EDF6F0] dark:bg-[#1C3023]'
                  : 'border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25]'
              }`}>
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free" className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-stone-800 dark:text-stone-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#488C64]" />
                  Livre Imediatamente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="checkoutNotes" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Notas do Fecho (opcional)
            </Label>
            <Textarea
              id="checkoutNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Chave entregue sem danos; frigobar conferido..."
              rows={2}
              className="resize-none text-xs rounded-xl bg-[#FAF7F2] dark:bg-[#251D18] border-[#E5DFD6] dark:border-[#2C3440]"
            />
          </div>

          <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto rounded-xl border-[#E5DFD6] dark:border-[#2C3440] hover:bg-[#F4EDE0]"
            >
              Cancelar
            </Button>

            {stay.clientPhone && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSendWhatsAppReceipt}
                disabled={loading}
                className="w-full sm:w-auto rounded-xl border-[#CDE5D5] text-[#245D3B] dark:border-[#2E543C] dark:text-[#64C28D] bg-[#EDF6F0] dark:bg-[#1C3325] hover:bg-[#DDF0E2] font-semibold flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                Recibo WhatsApp
              </Button>
            )}

            <Button
              type="submit"
              className="w-full sm:w-auto bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] hover:from-[#A87019] hover:to-[#B55E22] text-white font-bold rounded-xl shadow-md shadow-[#C58A2C]/20 transition-all"
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
