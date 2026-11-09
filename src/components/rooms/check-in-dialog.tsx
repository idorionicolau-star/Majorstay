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
import { BedDouble, Clock, User, Phone, DollarSign, CreditCard, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { toast } from '@/hooks/use-toast';

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRoomId?: string | null;
}

const PRESET_HOURS = [
  { label: '1 hora', hours: 1 },
  { label: '2 horas', hours: 2 },
  { label: '3 horas', hours: 3 },
  { label: '4 horas', hours: 4 },
  { label: '6 horas', hours: 6 },
  { label: '12 horas', hours: 12 },
  { label: '24h / Pernoite', hours: 24 },
];

const PAYMENT_METHODS = [
  { id: 'Dinheiro', label: 'Dinheiro (Numerário)' },
  { id: 'M-Pesa', label: 'M-Pesa (Vodacom)' },
  { id: 'E-Mola', label: 'E-Mola (Movitel)' },
  { id: 'Ponto24', label: 'Ponto24' },
  { id: 'Cartão / POS', label: 'Cartão / TPA' },
  { id: 'Transferência', label: 'Transferência Bancária' },
];

export function CheckInDialog({ open, onOpenChange, preselectedRoomId }: CheckInDialogProps) {
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
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[#FFFDF9] dark:bg-[#1E1714] border-[#E5DFD6] dark:border-[#382D26] shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-xl font-headline font-bold text-stone-900 dark:text-stone-100">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <BedDouble className="h-5 w-5" />
            </div>
            Novo Check-in de Quarto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Seleção do Quarto */}
          <div className="space-y-1.5">
            <Label htmlFor="roomSelect" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Quarto a Ocupar *
            </Label>
            <Select value={roomId} onValueChange={handleRoomChange}>
              <SelectTrigger id="roomSelect" className="h-11 rounded-xl bg-[#FAF7F2] dark:bg-[#251D18] border-[#E5DFD6] dark:border-[#382D26]">
                <SelectValue placeholder="Selecione um quarto..." />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFDF9] dark:bg-[#1E1714] border-[#E5DFD6] dark:border-[#382D26]">
                {freeRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-semibold text-stone-900 dark:text-stone-100">{r.name}</span>
                      <span className="text-xs text-stone-500 font-normal">
                        {formatCurrency(r.ratePerHour)}/hora (mín. {r.minimumHours || 1}h)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoom && (
              <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 pt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-[#DF9E42]" />
                Tarifa base deste quarto: <strong className="text-stone-800 dark:text-stone-200">{formatCurrency(ratePerHour)}/hora</strong>
              </p>
            )}
          </div>

          {/* Duração Contratada (Horas) */}
          <div className="space-y-2.5 p-3.5 bg-[#FAF7F2] dark:bg-[#261D19] rounded-2xl border border-[#EBE3D5] dark:border-[#382B24]">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Duração da Estadia *
              </Label>
              <span className="text-sm font-headline font-bold text-primary">
                {contractedHours} {contractedHours === 1 ? 'hora' : 'horas'}
              </span>
            </div>

            {/* Botões rápidos */}
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_HOURS.slice(0, 4).map((p) => (
                <Button
                  key={p.hours}
                  type="button"
                  size="sm"
                  variant={contractedHours === p.hours ? 'default' : 'outline'}
                  className={`h-8 text-xs font-semibold rounded-xl transition-all ${
                    contractedHours === p.hours
                      ? 'bg-[#BA5A1A] hover:bg-[#9C4811] text-white shadow-sm'
                      : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#1E1714] text-stone-700 dark:text-stone-200 hover:bg-[#F4EDE0]'
                  }`}
                  onClick={() => setContractedHours(p.hours)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_HOURS.slice(4).map((p) => (
                <Button
                  key={p.hours}
                  type="button"
                  size="sm"
                  variant={contractedHours === p.hours ? 'default' : 'outline'}
                  className={`h-8 text-xs font-semibold rounded-xl transition-all ${
                    contractedHours === p.hours
                      ? 'bg-[#BA5A1A] hover:bg-[#9C4811] text-white shadow-sm'
                      : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#1E1714] text-stone-700 dark:text-stone-200 hover:bg-[#F4EDE0]'
                  }`}
                  onClick={() => setContractedHours(p.hours)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Resumo de valor */}
            <div className="mt-2 pt-2.5 border-t border-[#EBE3D5] dark:border-[#382B24] flex items-center justify-between">
              <span className="text-xs text-stone-500 font-medium">Valor Inicial a Cobrar:</span>
              <span className="text-lg font-headline font-black text-[#BA5A1A] dark:text-[#E0852E]">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Dados do Hóspede */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="clientName" className="text-xs font-semibold flex items-center gap-1 text-stone-700 dark:text-stone-300">
                <User className="h-3.5 w-3.5 text-stone-400" />
                Nome do Hóspede
              </Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Carlos Mondlane"
                className="h-10 rounded-xl bg-[#FAF7F2] dark:bg-[#251D18] border-[#E5DFD6] dark:border-[#382D26]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="clientPhone" className="text-xs font-semibold flex items-center gap-1 text-stone-700 dark:text-stone-300">
                <Phone className="h-3.5 w-3.5 text-stone-400" />
                Contacto Telefónico (opcional)
              </Label>
              <Input
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="84 / 82 / 87..."
                className="h-10 rounded-xl bg-[#FAF7F2] dark:bg-[#251D18] border-[#E5DFD6] dark:border-[#382D26]"
              />
            </div>
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="paymentMethod" className="text-xs font-semibold flex items-center gap-1 text-stone-700 dark:text-stone-300">
              <CreditCard className="h-3.5 w-3.5 text-stone-400" />
              Método de Pagamento Inicial
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="paymentMethod" className="h-10 rounded-xl bg-[#FAF7F2] dark:bg-[#251D18] border-[#E5DFD6] dark:border-[#382D26]">
                <SelectValue placeholder="Selecione o método..." />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFDF9] dark:bg-[#1E1714] border-[#E5DFD6] dark:border-[#382D26]">
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações / Notas */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Observações (opcional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pagamento adiantado; cliente solicitou toalhas adicionais..."
              rows={2}
              className="resize-none text-xs rounded-xl bg-[#FAF7F2] dark:bg-[#251D18] border-[#E5DFD6] dark:border-[#382D26]"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl border-[#E5DFD6] dark:border-[#382D26] hover:bg-[#F4EDE0]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#BA5A1A] hover:bg-[#9C4811] text-white font-bold rounded-xl shadow-sm transition-all"
              disabled={loading || !roomId}
            >
              {loading ? 'A Registar...' : `Confirmar Check-in (${formatCurrency(totalAmount)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
