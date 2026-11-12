'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BedDouble,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Plus,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  Calendar,
  MessageCircle,
  QrCode,
} from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import { computeRoomCleaningStatus } from '@/lib/hospitality-calc';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';
import { RoomCard } from '@/components/rooms/room-card';
import { PendingRoomOrders } from '@/components/rooms/pending-orders';
import { CheckInDialog } from '@/components/rooms/check-in-dialog';
import { ExtendStayDialog } from '@/components/rooms/extend-stay-dialog';
import { CheckOutDialog } from '@/components/rooms/check-out-dialog';
import { RoomFormDialog } from '@/components/rooms/room-form-dialog';
import { RoomConsumptionDialog } from '@/components/rooms/room-consumption-dialog';
import { BookingDialog } from '@/components/rooms/booking-dialog';
import { BookingsListDialog } from '@/components/rooms/bookings-list-dialog';
import { RoomQrDialog } from '@/components/rooms/room-qr-dialog';
import type { Room, Stay, Booking } from '@/lib/types';

type FilterTab = 'all' | 'free' | 'occupied' | 'overtime' | 'cleaning' | 'open';

const VALID_FILTERS: FilterTab[] = ['all', 'free', 'occupied', 'overtime', 'cleaning', 'open'];

function parseFilter(value: string | null): FilterTab {
  return value && (VALID_FILTERS as string[]).includes(value) ? (value as FilterTab) : 'all';
}

function RoomsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtroParam = searchParams.get('filtro');
  const quartoParam = searchParams.get('quarto');
  const {
    rooms,
    openStays,
    stays,
    bookings = [],
    addBooking,
    cancelBooking,
    updateBookingStatus,
    loading,
    stats,
    refreshRealtimeStatuses,
  } = useRooms();
  const { user } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';

  // O filtro e o quarto vêm do endereço (?filtro=free|occupied|overtime|cleaning|open e ?quarto=ID),
  // para que um alerta ou cartão do painel abra já a lista certa.
  const [activeTab, setActiveTab] = useState<FilterTab>(() => parseFilter(filtroParam));
  const [focusRoomId, setFocusRoomId] = useState<string | null>(quartoParam);

  useEffect(() => {
    setActiveTab(parseFilter(filtroParam));
  }, [filtroParam]);

  useEffect(() => {
    setFocusRoomId(quartoParam);
  }, [quartoParam]);

  const selectTab = (tab: FilterTab) => {
    setActiveTab(tab);
    setFocusRoomId(null);
    router.replace(tab === 'all' ? '/rooms' : `/rooms?filtro=${tab}`, { scroll: false });
  };
  const [searchTerm, setSearchTerm] = useState('');

  const delayedCleaningCount = useMemo(() => {
    return rooms.filter((r) => {
      if (r.status !== 'cleaning' || !r.cleaningStartedAt) return false;
      const cStatus = computeRoomCleaningStatus({
        cleaningStartedAt: r.cleaningStartedAt,
        cleaningDurationMinutes: r.cleaningDurationMinutes,
      });
      return cStatus?.isDelayed;
    }).length;
  }, [rooms]);


  // Modais de Estadia e Quartos
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState<Room | null>(null);
  const [prefillGuestName, setPrefillGuestName] = useState<string>('');
  const [prefillGuestPhone, setPrefillGuestPhone] = useState<string>('');
  const [prefillHours, setPrefillHours] = useState<number>(1);

  const [extendOpen, setExtendOpen] = useState(false);
  const [stayToExtend, setStayToExtend] = useState<Stay | null>(null);
  const [roomToExtend, setRoomToExtend] = useState<Room | null>(null);

  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [stayToCheckOut, setStayToCheckOut] = useState<Stay | null>(null);
  const [roomToCheckOut, setRoomToCheckOut] = useState<Room | null>(null);

  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null);

  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [stayForConsumption, setStayForConsumption] = useState<Stay | null>(null);
  const [roomForConsumption, setRoomForConsumption] = useState<Room | null>(null);

  // Modais de Reservas Antecipadas
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingsListOpen, setBookingsListOpen] = useState(false);

  // Modal de QR Code e Visor do Quarto
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [roomForQr, setRoomForQr] = useState<Room | null>(null);

  const handleOpenQrDialog = (room: Room) => {
    setRoomForQr(room);
    setQrDialogOpen(true);
  };

  const activeBookingsCount = useMemo(() => {
    return bookings.filter((b) => b.status === 'confirmed').length;
  }, [bookings]);

  const handleOpenConsumption = (room: Room, stay: Stay) => {
    setRoomForConsumption(room);
    setStayForConsumption(stay);
    setConsumptionOpen(true);
  };

  // Mapear cada quarto para a sua estadia aberta correspondente
  const staysByRoomId = useMemo(() => {
    const map = new Map<string, Stay>();
    openStays.forEach((s) => {
      if (s.roomId) map.set(s.roomId, s);
    });
    return map;
  }, [openStays]);

  // Filtragem dos quartos
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Um quarto específico (?quarto=ID)
      if (focusRoomId && room.id !== focusRoomId) return false;

      // Filtro por tab
      if (activeTab === 'open' && room.status !== 'occupied' && room.status !== 'overtime') return false;
      if (activeTab === 'free' && room.status !== 'free') return false;
      if (activeTab === 'occupied' && room.status !== 'occupied') return false;
      if (activeTab === 'overtime' && room.status !== 'overtime') return false;
      if (activeTab === 'cleaning' && room.status !== 'cleaning') return false;

      // Filtro de pesquisa
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const activeStay = staysByRoomId.get(room.id);
        const matchRoomName = room.name.toLowerCase().includes(query);
        const matchType = (room.type || '').toLowerCase().includes(query);
        const matchClient = (activeStay?.clientName || '').toLowerCase().includes(query);
        const matchPhone = (activeStay?.clientPhone || '').includes(query);
        return matchRoomName || matchType || matchClient || matchPhone;
      }

      return true;
    });
  }, [rooms, activeTab, focusRoomId, searchTerm, staysByRoomId]);

  // Ações dos modais e navegação
  const handleOpenCheckIn = (room?: Room) => {
    if (room?.id) {
      router.push(`/rooms/checkin?roomId=${room.id}`);
    } else {
      router.push('/rooms/checkin');
    }
  };

  const handleCheckInFromBooking = async (booking: Booking) => {
    setBookingsListOpen(false);
    const params = new URLSearchParams();
    if (booking.roomId) params.set('roomId', booking.roomId);
    if (booking.id) params.set('bookingId', booking.id);
    if (booking.clientName) params.set('name', booking.clientName);
    if (booking.clientPhone) params.set('phone', booking.clientPhone);
    if (booking.durationHours) params.set('hours', String(booking.durationHours));
    router.push(`/rooms/checkin?${params.toString()}`);
  };

  const handleOpenExtend = (room: Room, stay: Stay) => {
    setRoomToExtend(room);
    setStayToExtend(stay);
    setExtendOpen(true);
  };

  const handleOpenCheckOut = (room: Room, stay: Stay) => {
    setRoomToCheckOut(room);
    setStayToCheckOut(stay);
    setCheckOutOpen(true);
  };

  const handleOpenNewRoom = () => {
    setRoomToEdit(null);
    setRoomFormOpen(true);
  };

  const handleOpenEditRoom = (room: Room) => {
    setRoomToEdit(room);
    setRoomFormOpen(true);
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* Cabeçalho Responsivo da Página em Estilo Stitch 2 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
              <BedDouble className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                Quadro de Quartos & Suítes
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                Monitorização ao segundo, check-in tátil, reservas antecipadas e controlo de estadias.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação com Pílulas e Dourado/Azul Stitch */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshRealtimeStatuses}
            title="Atualizar status dos quartos"
            className="h-10 text-xs gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-medium px-3.5 shadow-xs active:scale-95 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>

          {/* Reservas Antecipadas */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBookingsListOpen(true)}
            className="h-10 text-xs gap-1.5 rounded-full border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-bold px-4 shadow-xs active:scale-95 transition-all"
          >
            <Calendar className="h-3.5 w-3.5 text-amber-600" />
            Reservas ({activeBookingsCount})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setBookingDialogOpen(true)}
            className="h-10 text-xs gap-1.5 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 text-[#007bb9] dark:text-sky-300 hover:bg-blue-100 font-bold px-4 shadow-xs active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-[#007bb9]" />
            Nova Reserva
          </Button>

          {/* QR Code / Visor de Quartos */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (rooms.length > 0) {
                handleOpenQrDialog(rooms[0]);
              }
            }}
            className="h-10 text-xs gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold px-4 shadow-xs active:scale-95 transition-all"
            title="Ver e imprimir QR Code para as mesas de cabeceira dos quartos"
          >
            <QrCode className="h-3.5 w-3.5 text-slate-500" />
            QR Mesas
          </Button>

          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenNewRoom}
              className="h-10 text-xs gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold px-4 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="h-3.5 w-3.5 text-[#007bb9]" />
              Novo Quarto
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleOpenCheckIn()}
            className="h-10 text-xs gap-2 bg-[#007bb9] hover:bg-[#006194] text-white font-extrabold rounded-full px-5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Novo Check-in
          </Button>
        </div>
      </div>

      {/* Indicadores Stitch 2 Lingora com Pílulas e Sombras Macias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* Livres */}
        <div
          onClick={() => selectTab('free')}
          className={cn(
            'p-4 rounded-3xl border transition-all cursor-pointer shadow-card hover:shadow-soft-hover min-w-0',
            activeTab === 'free'
              ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/40'
              : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">Livres</p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {stats.free}
              </p>
            </div>
          </div>
        </div>

        {/* Ocupados */}
        <div
          onClick={() => selectTab('occupied')}
          className={cn(
            'p-4 rounded-3xl border transition-all cursor-pointer shadow-card hover:shadow-soft-hover min-w-0',
            activeTab === 'occupied'
              ? 'border-blue-300 ring-2 ring-[#007bb9]/20 bg-blue-50/70 dark:bg-blue-950/40'
              : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] hover:border-blue-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border border-blue-200/60 dark:border-blue-800/50 flex items-center justify-center shrink-0">
              <BedDouble className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">Ocupados</p>
              <p className="text-2xl font-black text-[#007bb9] dark:text-sky-400">
                {stats.occupied}
              </p>
            </div>
          </div>
        </div>

        {/* Tempo Excedido */}
        <div
          onClick={() => selectTab('overtime')}
          className={cn(
            'p-4 rounded-3xl border transition-all cursor-pointer shadow-card hover:shadow-soft-hover min-w-0',
            activeTab === 'overtime'
              ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/70 dark:bg-rose-950/40'
              : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] hover:border-rose-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border',
              stats.overtime > 0
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">Excedidos</p>
              <p className={cn(
                'text-2xl font-black',
                stats.overtime > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
              )}>
                {stats.overtime}
              </p>
            </div>
          </div>
        </div>

        {/* Em Limpeza */}
        <div
          onClick={() => selectTab('cleaning')}
          className={cn(
            'p-4 rounded-3xl border transition-all cursor-pointer shadow-card hover:shadow-soft-hover min-w-0',
            activeTab === 'cleaning'
              ? 'border-sky-300 ring-2 ring-sky-500/20 bg-sky-50/70 dark:bg-sky-950/40'
              : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] hover:border-sky-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/50 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">Limpeza</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-2xl font-black text-sky-700 dark:text-sky-300">
                  {stats.cleaning}
                </p>
                {delayedCleaningCount > 0 && (
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 animate-pulse">
                    ({delayedCleaningCount} atrasado{delayedCleaningCount > 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Faturado Hoje */}
        <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card col-span-2 sm:col-span-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">Faturado Hoje</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                {formatCurrency(stats.revenueToday)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <PendingRoomOrders />

      {/* Barra de Filtros e Pesquisa com Pílulas Suaves */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#191E25] p-2.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-card">
        {/* Abas Rápidas com Pílulas Stitch */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'whitespace-nowrap shrink-0 text-xs font-bold h-9 rounded-2xl transition-all px-3.5',
              activeTab === 'all'
                ? 'bg-[#007bb9] text-white hover:bg-[#006194] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            onClick={() => selectTab('all')}
          >
            Todos ({rooms.length})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'whitespace-nowrap shrink-0 text-xs font-bold h-9 rounded-2xl gap-1.5 transition-all px-3.5',
              activeTab === 'free'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            onClick={() => selectTab('free')}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Livres ({stats.free})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'whitespace-nowrap shrink-0 text-xs font-bold h-9 rounded-2xl gap-1.5 transition-all px-3.5',
              activeTab === 'occupied'
                ? 'bg-blue-50 text-[#007bb9] dark:bg-blue-950/60 dark:text-sky-300 border border-blue-200/80 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            onClick={() => selectTab('occupied')}
          >
            <BedDouble className="h-3.5 w-3.5 text-[#007bb9]" />
            Ocupados ({stats.occupied})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'whitespace-nowrap shrink-0 text-xs font-bold h-9 rounded-2xl gap-1.5 transition-all px-3.5',
              activeTab === 'overtime'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            onClick={() => selectTab('overtime')}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            Excedidos ({stats.overtime})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'whitespace-nowrap shrink-0 text-xs font-bold h-9 rounded-2xl gap-1.5 transition-all px-3.5',
              activeTab === 'cleaning'
                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            onClick={() => selectTab('cleaning')}
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            Limpeza ({stats.cleaning})
            {delayedCleaningCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-white rounded-full leading-none animate-pulse">
                {delayedCleaningCount}
              </span>
            )}
          </Button>
        </div>

        {/* Campo de Pesquisa */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Pesquisar quarto ou hóspede..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 text-xs rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-[#007bb9]"
          />
        </div>
      </div>

      {(activeTab === 'open' || focusRoomId) && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-2.5 text-xs font-semibold text-[#006194] dark:text-sky-300">
          <span>{focusRoomId ? 'A mostrar apenas o quarto selecionado' : 'A mostrar apenas quartos com estadia aberta'}</span>
          <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs font-bold shrink-0" onClick={() => selectTab('all')}>
            Ver todos
          </Button>
        </div>
      )}

      {/* Grelha de Quartos */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-[#EFEBE4]/60 dark:bg-[#1E242D] animate-pulse border border-[#E5DFD6]/60 dark:border-[#2C3440]/60" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <BedDouble className="h-6 w-6" />
          </div>
          <h3 className="font-headline font-bold text-lg text-stone-900 dark:text-stone-100">
            Nenhum quarto encontrado
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchTerm
              ? `Não foram encontrados quartos com o termo "${searchTerm}".`
              : activeTab !== 'all'
              ? 'Não existem quartos no estado selecionado neste momento.'
              : 'Ainda não cadastrou quartos no seu alojamento. Comece criando o seu primeiro quarto!'}
          </p>
          {isManager && rooms.length === 0 && (
            <Button
              onClick={handleOpenNewRoom}
              className="bg-[#C58A2C] hover:bg-[#A87019] text-white font-bold rounded-xl mt-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Cadastrar Primeiro Quarto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
          {filteredRooms.map((room) => {
            const stay = staysByRoomId.get(room.id);
            return (
              <RoomCard
                key={room.id}
                room={room}
                stay={stay}
                onCheckIn={handleOpenCheckIn}
                onExtend={handleOpenExtend}
                onCheckOut={handleOpenCheckOut}
                onConsumption={handleOpenConsumption}
                onEditRoom={handleOpenEditRoom}
                onShowQrCode={handleOpenQrDialog}
              />
            );
          })}
        </div>
      )}

      {/* Diálogos Operacionais de Quartos */}
      <CheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        preselectedRoomId={selectedRoomForCheckIn?.id}
        initialGuestName={prefillGuestName}
        initialGuestPhone={prefillGuestPhone}
        initialHours={prefillHours}
      />

      <ExtendStayDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        stay={stayToExtend}
        room={roomToExtend}
      />

      <CheckOutDialog
        open={checkOutOpen}
        onOpenChange={setCheckOutOpen}
        stay={stayToCheckOut}
        room={roomToCheckOut}
      />

      <RoomFormDialog
        open={roomFormOpen}
        onOpenChange={setRoomFormOpen}
        roomToEdit={roomToEdit}
      />

      <RoomConsumptionDialog
        open={consumptionOpen}
        onOpenChange={setConsumptionOpen}
        stay={stayForConsumption}
        room={roomForConsumption}
      />

      {/* Diálogos de Reservas Antecipadas */}
      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        rooms={rooms}
        onSaveBooking={addBooking}
      />

      <BookingsListDialog
        open={bookingsListOpen}
        onOpenChange={setBookingsListOpen}
        bookings={bookings}
        rooms={rooms}
        onNewBookingClick={() => {
          setBookingsListOpen(false);
          setBookingDialogOpen(true);
        }}
        onCheckInFromBooking={handleCheckInFromBooking}
        onCancelBooking={cancelBooking}
      />

      <RoomQrDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        room={roomForQr}
      />
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense fallback={null}>
      <RoomsPageContent />
    </Suspense>
  );
}
