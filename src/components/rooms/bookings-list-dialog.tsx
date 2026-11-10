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
  User,
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
          <Badge className="bg-[#EDF6F0] text-[#245D3B] dark:bg-[#1C3325] dark:text-[#64C28D] border border-[#CDE5D5] dark:border-[#2E543C] text-[10px] font-bold">
            Confirmada
          </Badge>
        );
      case 'checked_in':
        return (
          <Badge className="bg-[#FDF6E8] text-[#C58A2C] dark:bg-[#34241B] dark:text-[#E88C4A] border border-[#F6E0B5] dark:border-[#523A2C] text-[10px] font-bold">
            Check-in Realizado
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-[#FDF0EE] text-[#C53030] dark:bg-[#3A1E1E] dark:text-[#E56B6B] border border-[#FBD5D0] dark:border-[#602929] text-[10px] font-bold">
            Cancelada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold">
            Pendente
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] text-[#251D18] dark:text-[#F5EFEB] shadow-xl">
        <DialogHeader className="p-5 pb-3 border-b border-[#E5DFD6] dark:border-[#2C3440] bg-[#F8F5EE]/80 dark:bg-[#261E1A]/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FDF6E8] dark:bg-[#34241B] border border-[#F6E0B5] dark:border-[#523A2C] flex items-center justify-center text-[#C58A2C]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-[#251D18] dark:text-[#F5EFEB]">
                  Reservas Antecipadas ({bookings.length})
                </DialogTitle>
                <p className="text-xs text-[#827568] dark:text-[#B0A294]">
                  Gestão de chamadas, pedidos prévios e confirmações por WhatsApp
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={onNewBookingClick}
              className="h-9 px-3 text-xs font-bold rounded-xl bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] hover:from-[#A87019] hover:to-[#B55E22] text-white shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Reserva
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {/* Barra de Filtros e Busca com Zero Overlap */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
              <Input
                placeholder="Pesquisar por hóspede, telefone ou quarto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#F2ECE1] dark:bg-[#2A211B] p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar">
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
                    className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      active
                        ? 'bg-white dark:bg-[#111418] text-[#C58A2C] shadow-sm'
                        : 'text-[#5C5346] dark:text-[#D4C8B8] hover:text-[#251D18]'
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
            <div className="text-center py-12 text-[#827568] dark:text-[#B0A294] text-xs">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30 text-[#C58A2C]" />
              <p className="font-semibold text-sm text-[#251D18] dark:text-[#F5EFEB]">
                Nenhuma reserva encontrada
              </p>
              <p className="text-[11px] mt-1">
                Toque em "Nova Reserva" para registar quando um cliente ligar ou agendar.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
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
                    className="p-3.5 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C58A2C]/40 transition-all"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#251D18] dark:text-[#F5EFEB] truncate">
                          {b.clientName}
                        </span>
                        {getStatusBadge(b.status)}
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F2ECE1] dark:bg-[#2A211B] text-[#5C5346] dark:text-[#D4C8B8]">
                          {b.roomName || 'Quarto a Atribuir'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#827568] dark:text-[#B0A294]">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5 text-[#C58A2C]" />
                          {b.clientPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#DF9E42]" />
                          {dateFormatted} às {timeFormatted} ({b.isOvernight ? 'Pernoita' : `${b.durationHours}h`})
                        </span>
                        {b.depositAmount && b.depositAmount > 0 ? (
                          <span className="flex items-center gap-1 font-bold text-[#245D3B] dark:text-[#64C28D]">
                            <Coins className="w-3.5 h-3.5" />
                            Sinal: {formatCurrency(b.depositAmount)}
                          </span>
                        ) : null}
                      </div>

                      {b.notes && (
                        <p className="text-[11px] text-[#A69B93] italic line-clamp-1">
                          "{b.notes}"
                        </p>
                      )}
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* WhatsApp */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWhatsApp(b)}
                        className="h-9 px-2.5 text-xs rounded-xl border-[#CDE5D5] dark:border-[#2E543C] text-[#245D3B] dark:text-[#64C28D] bg-[#EDF6F0] dark:bg-[#1C3325] hover:bg-[#DDF0E2] font-semibold gap-1"
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
                          className="h-9 px-3 text-xs rounded-xl font-bold bg-[#C58A2C] hover:bg-[#A87019] text-white shadow-sm gap-1"
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
                          className="h-9 w-9 p-0 rounded-xl text-[#C53030] hover:bg-[#FDF0EE] dark:hover:bg-[#3A1E1E]"
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

        <DialogFooter className="p-3 border-t border-[#E5DFD6] dark:border-[#2C3440] bg-[#F8F5EE]/50 dark:bg-[#261E1A]/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-[#E5DFD6] dark:border-[#2C3440]"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
