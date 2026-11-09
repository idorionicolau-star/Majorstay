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
      // Reset form
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
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <BedDouble className="h-6 w-6 text-emerald-600" />
            Novo Check-in de Quarto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Seleção do Quarto */}
          <div className="space-y-1.5">
            <Label htmlFor="roomSelect" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Quarto a Ocupar *
            </Label>
            <Select value={roomId} onValueChange={handleRoomChange}>
              <SelectTrigger id="roomSelect" className="h-11">
                <SelectValue placeholder="Selecione um quarto..." />
              </SelectTrigger>
              <SelectContent>
                {freeRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-xs text-slate-500 font-normal">
                        {formatCurrency(r.ratePerHour)}/hora (mín. {r.minimumHours || 1}h)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoom && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Tarifa base deste quarto: <strong>{formatCurrency(ratePerHour)}/hora</strong>
              </p>
            )}
          </div>

          {/* Duração Contratada (Horas) */}
          <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Horas Contratadas Inicialmente *
              </Label>
              <span className="text-sm font-bold text-primary">
                {contractedHours} {contractedHours === 1 ? 'hora' : 'horas'}
              </span>
            </div>

            {/* Botoes rapidos */}
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_HOURS.slice(0, 4).map((p) => (
                <Button
                  key={p.hours}
                  type="button"
                  size="sm"
                  variant={contractedHours === p.hours ? 'default' : 'outline'}
                  className="h-8 text-xs font-medium"
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
                  className="h-8 text-xs font-medium"
                  onClick={() => setContractedHours(p.hours)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Resumo de valor */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Valor Inicial a Cobrar:</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Dados do Hóspede */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="clientName" className="text-xs font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Nome do Hóspede
              </Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Carlos Mondlane"
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="clientPhone" className="text-xs font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                Contacto Telefónico (opcional)
              </Label>
              <Input
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="84 / 82 / 87..."
                className="h-10"
              />
            </div>
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="paymentMethod" className="text-xs font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              Método de Pagamento Inicial
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="paymentMethod" className="h-10">
                <SelectValue placeholder="Selecione o método..." />
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

          {/* Observações / Notas */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Observações (opcional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pagamento adiantado; cliente solicitou toalhas adicionais..."
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
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
