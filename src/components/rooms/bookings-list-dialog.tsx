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
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Phone,
  Search,
  MessageCircle,
  LogIn,
  XCircle,
  Plus,
  Coins,
} from 'lucide-react';
import type { Booking, Room } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { normalizeDate } from '@/lib/hospitality-calc';
import { buildBookingWhatsAppMessage, openWhatsApp } from '@/lib/whatsapp';
import { useInventory } from '@/context/inventory-context';

interface BookingsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: Booking[];
  rooms: Room[];
  onNewBookingClick: () => void;
  onCheckInFromBooking: (booking: Booking) => void;
  onCancelBooking: (bookingId: string) => void;
}

export function BookingsListDialog({
  open,
  onOpenChange,
  bookings,
  rooms,
  onNewBookingClick,
  onCheckInFromBooking,
  onCancelBooking,
}: BookingsListDialogProps) {
  const { companyData } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'checked_in' | 'cancelled'>('all');

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchClient = b.clientName.toLowerCase().includes(q);
      const matchPhone = b.clientPhone.includes(q);
      const matchRoom = (b.roomName || '').toLowerCase().includes(q);
      return matchClient || matchPhone || matchRoom;
    }
    return true;
  });

  const handleWhatsApp = (booking: Booking) => {
    const msg = buildBookingWhatsAppMessage(booking, companyData?.name);
    openWhatsApp(booking.clientPhone, msg);
  };

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-[10px] font-bold rounded-full px-2.5 py-0.5 shadow-none">
            Confirmada
          </Badge>
        );
      case 'checked_in':
        return (
          <Badge className="bg-sky-50 text-[#007bb9] dark:bg-sky-950/50 dark:text-sky-300 border border-blue-200/80 dark:border-blue-800 text-[10px] font-bold rounded-full px-2.5 py-0.5 shadow-none">
            Check-in Feito
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 text-[10px] font-bold rounded-full px-2.5 py-0.5 shadow-none">
            Cancelada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold rounded-full px-2.5 py-0.5">
            Pendente
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-3xl border border-blue-100/90 dark:border-slate-800 bg-white dark:bg-[#191E25] text-slate-800 dark:text-slate-100 shadow-2xl">
        {/* Faixa superior pastel nobre */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a]" />

        <DialogHeader className="px-7 pt-5 pb-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Reservas Antecipadas ({bookings.length})
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Gestão de chamadas, pedidos prévios e confirmações por WhatsApp
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={onNewBookingClick}
              className="h-10 px-4 text-xs font-bold rounded-full bg-[#007bb9] hover:bg-[#006194] text-white shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nova Reserva
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Pesquisar por hóspede, telefone ou quarto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 text-xs rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 focus-visible:ring-[#007bb9]"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl shrink-0 overflow-x-auto no-scrollbar">
              {(['all', 'confirmed', 'checked_in', 'cancelled'] as const).map((st) => {
                const label =
                  st === 'all'
                    ? 'Todas'
                    : st === 'confirmed'
                    ? 'Confirmadas'
                    : st === 'checked_in'
                    ? 'Com Check-in'
                    : 'Canceladas';
                const active = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      active
                        ? 'bg-white dark:bg-[#191E25] text-[#007bb9] dark:text-sky-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Reservas */}
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30 text-[#007bb9]" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                Nenhuma reserva encontrada
              </p>
              <p className="text-[11px] mt-1 text-slate-400">
                Toque em "Nova Reserva" para registar quando um cliente ligar ou agendar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((b) => {
                const dateObj = normalizeDate(b.checkInDate);
                const dateFormatted = dateObj.toLocaleDateString('pt-MZ', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
                const timeFormatted = dateObj.toLocaleTimeString('pt-MZ', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={b.id}
                    className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-800/60 transition-all"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {b.clientName}
                        </span>
                        {getStatusBadge(b.status)}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {b.roomName || 'Quarto a Atribuir'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300 font-medium">
                          <Phone className="w-3.5 h-3.5 text-[#007bb9]" />
                          {b.clientPhone}
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          {dateFormatted} às {timeFormatted} ({b.isOvernight ? 'Pernoita' : `${b.durationHours}h`})
                        </span>
                        {b.depositAmount && b.depositAmount > 0 ? (
                          <span className="flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400">
                            <Coins className="w-3.5 h-3.5 text-amber-500" />
                            Sinal: {formatCurrency(b.depositAmount)}
                          </span>
                        ) : null}
                      </div>

                      {b.notes && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-1">
                          "{b.notes}"
                        </p>
                      )}
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* WhatsApp */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWhatsApp(b)}
                        className="h-9 px-3 text-xs rounded-full border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 font-bold gap-1 shadow-xs"
                        title="Enviar comprovativo de reserva por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        WhatsApp
                      </Button>

                      {/* Check-in */}
                      {b.status === 'confirmed' && (
                        <Button
                          size="sm"
                          onClick={() => onCheckInFromBooking(b)}
                          className="h-9 px-3.5 text-xs rounded-full font-extrabold bg-[#007bb9] hover:bg-[#006194] text-white shadow-sm gap-1 active:scale-95 transition-all"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Check-in
                        </Button>
                      )}

                      {/* Cancelar */}
                      {b.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCancelBooking(b.id)}
                          className="h-9 w-9 p-0 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Cancelar reserva"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-7 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full border-slate-200 dark:border-slate-800 text-xs font-semibold px-5"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
