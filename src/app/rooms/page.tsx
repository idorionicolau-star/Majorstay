'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';
import { RoomCard } from '@/components/rooms/room-card';
import { CheckInDialog } from '@/components/rooms/check-in-dialog';
import { ExtendStayDialog } from '@/components/rooms/extend-stay-dialog';
import { CheckOutDialog } from '@/components/rooms/check-out-dialog';
import { RoomFormDialog } from '@/components/rooms/room-form-dialog';
import { RoomConsumptionDialog } from '@/components/rooms/room-consumption-dialog';
import { BookingDialog } from '@/components/rooms/booking-dialog';
import { BookingsListDialog } from '@/components/rooms/bookings-list-dialog';
import type { Room, Stay, Booking } from '@/lib/types';

type FilterTab = 'all' | 'free' | 'occupied' | 'overtime' | 'cleaning';

export default function RoomsPage() {
  const router = useRouter();
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

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
      // Filtro por tab
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
  }, [rooms, activeTab, searchTerm, staysByRoomId]);

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
      {/* Cabeçalho Responsivo da Página em Estilo Hotel Boutique */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-headline font-extrabold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <BedDouble className="h-6 w-6" />
            </div>
            <span className="truncate">Quadro de Quartos & Suítes</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 font-medium">
            Gestão de estadias em tempo real, reservas antecipadas, cobrança por hora ou pernoita e controlo de caixa.
          </p>
        </div>

        {/* Botões de Ação com Quebra Fluida */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshRealtimeStatuses}
            title="Atualizar status dos quartos"
            className="h-10 text-xs gap-1.5 rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] text-stone-700 dark:text-stone-200 hover:bg-[#F4EDE0]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>

          {/* Reservas Antecipadas */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBookingsListOpen(true)}
            className="h-10 text-xs gap-1.5 rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] text-stone-700 dark:text-stone-200 hover:bg-[#F4EDE0] font-semibold"
          >
            <Calendar className="h-3.5 w-3.5 text-[#DF9E42]" />
            Reservas ({activeBookingsCount})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setBookingDialogOpen(true)}
            className="h-10 text-xs gap-1.5 rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] text-stone-700 dark:text-stone-200 hover:bg-[#F4EDE0] font-semibold"
          >
            <Plus className="h-3.5 w-3.5 text-[#BA5A1A]" />
            Nova Reserva
          </Button>

          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenNewRoom}
              className="h-10 text-xs gap-1.5 rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] text-stone-700 dark:text-stone-200 hover:bg-[#F4EDE0] font-semibold"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              Novo Quarto
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleOpenCheckIn()}
            className="h-10 text-xs gap-1.5 bg-[#BA5A1A] hover:bg-[#9C4811] text-white font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            Novo Check-in
          </Button>
        </div>
      </div>

      {/* Cartões de Indicadores Responsivos (KPIs do topo) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {/* Livres */}
        <div
          onClick={() => setActiveTab('free')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-sm min-w-0 ${
            activeTab === 'free'
              ? 'border-[#488C64] ring-2 ring-[#488C64]/20 bg-[#EDF6F0] dark:bg-[#1C3023]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#488C64]/50'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#EDF6F0] text-[#245D3B] dark:bg-[#1C3023] dark:text-[#8CD9A9] shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider truncate">Livres</p>
              <p className="text-xl sm:text-2xl font-headline font-black text-[#245D3B] dark:text-[#8CD9A9]">
                {stats.free}
              </p>
            </div>
          </div>
        </div>

        {/* Ocupados */}
        <div
          onClick={() => setActiveTab('occupied')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-sm min-w-0 ${
            activeTab === 'occupied'
              ? 'border-[#BA5A1A] ring-2 ring-[#BA5A1A]/20 bg-[#FAF0E6] dark:bg-[#341F14]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#BA5A1A]/50'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#FAF0E6] text-[#BA5A1A] dark:bg-[#341F14] dark:text-[#F3B080] shrink-0">
              <BedDouble className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider truncate">Ocupados</p>
              <p className="text-xl sm:text-2xl font-headline font-black text-[#BA5A1A] dark:text-[#F3B080]">
                {stats.occupied}
              </p>
            </div>
          </div>
        </div>

        {/* Tempo Excedido */}
        <div
          onClick={() => setActiveTab('overtime')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-sm min-w-0 ${
            activeTab === 'overtime'
              ? 'border-[#C53030] ring-2 ring-[#C53030]/20 bg-[#FDF0EE] dark:bg-[#381616]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#C53030]/50'
          } ${stats.overtime > 0 ? 'animate-pulse' : ''}`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${stats.overtime > 0 ? 'bg-[#FDF0EE] text-[#C53030] dark:bg-[#381616] dark:text-[#FEB2B2]' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider truncate">Excedidos</p>
              <p className={`text-xl sm:text-2xl font-headline font-black ${stats.overtime > 0 ? 'text-[#C53030] dark:text-[#FEB2B2]' : 'text-stone-700 dark:text-stone-300'}`}>
                {stats.overtime}
              </p>
            </div>
          </div>
        </div>

        {/* Em Limpeza */}
        <div
          onClick={() => setActiveTab('cleaning')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-sm min-w-0 ${
            activeTab === 'cleaning'
              ? 'border-[#DF9E42] ring-2 ring-[#DF9E42]/20 bg-[#FAF4E6] dark:bg-[#322510]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#DF9E42]/50'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#FAF4E6] text-[#975A16] dark:bg-[#322510] dark:text-[#ECC94B] shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider truncate">Limpeza</p>
              <p className="text-xl sm:text-2xl font-headline font-black text-[#975A16] dark:text-[#ECC94B]">
                {stats.cleaning}
              </p>
            </div>
          </div>
        </div>

        {/* Faturado Hoje */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] shadow-sm col-span-2 sm:col-span-1 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#FFFBF0] text-[#BA5A1A] dark:bg-[#2A2012] dark:text-[#DF9E42] shrink-0">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider truncate">Faturado Hoje</p>
              <p className="text-lg sm:text-xl font-headline font-black text-stone-900 dark:text-stone-100 truncate">
                {formatCurrency(stats.revenueToday)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa com Zero-Overlap */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#FFFDF9] dark:bg-[#201915] p-2.5 rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] shadow-sm">
        {/* Abas Rápidas com No-Wrap */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className={`whitespace-nowrap shrink-0 text-xs font-semibold h-9 rounded-xl transition-all ${
              activeTab === 'all'
                ? 'bg-[#BA5A1A] text-white hover:bg-[#BA5A1A] shadow-sm font-bold'
                : 'text-stone-600 dark:text-stone-300 hover:bg-[#F4EDE0] dark:hover:bg-[#2A221E]'
            }`}
            onClick={() => setActiveTab('all')}
          >
            Todos ({rooms.length})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`whitespace-nowrap shrink-0 text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
              activeTab === 'free'
                ? 'bg-[#EDF6F0] text-[#245D3B] dark:bg-[#1C3023] dark:text-[#8CD9A9] font-bold border border-[#CDE5D5]'
                : 'text-stone-600 dark:text-stone-300 hover:bg-[#F4EDE0] dark:hover:bg-[#2A221E]'
            }`}
            onClick={() => setActiveTab('free')}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[#488C64]" />
            Livres ({stats.free})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`whitespace-nowrap shrink-0 text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
              activeTab === 'occupied'
                ? 'bg-[#FAF0E6] text-[#BA5A1A] dark:bg-[#341F14] dark:text-[#F3B080] font-bold border border-[#F0D5C0]'
                : 'text-stone-600 dark:text-stone-300 hover:bg-[#F4EDE0] dark:hover:bg-[#2A221E]'
            }`}
            onClick={() => setActiveTab('occupied')}
          >
            <BedDouble className="h-3.5 w-3.5 text-[#BA5A1A]" />
            Ocupados ({stats.occupied})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`whitespace-nowrap shrink-0 text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
              activeTab === 'overtime'
                ? 'bg-[#FDF0EE] text-[#C53030] dark:bg-[#381616] dark:text-[#FEB2B2] font-bold border border-[#FBD5D0]'
                : 'text-stone-600 dark:text-stone-300 hover:bg-[#F4EDE0] dark:hover:bg-[#2A221E]'
            }`}
            onClick={() => setActiveTab('overtime')}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-[#C53030]" />
            Excedidos ({stats.overtime})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`whitespace-nowrap shrink-0 text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
              activeTab === 'cleaning'
                ? 'bg-[#FAF4E6] text-[#975A16] dark:bg-[#322510] dark:text-[#ECC94B] font-bold border border-[#F6E0B5]'
                : 'text-stone-600 dark:text-stone-300 hover:bg-[#F4EDE0] dark:hover:bg-[#2A221E]'
            }`}
            onClick={() => setActiveTab('cleaning')}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#DF9E42]" />
            Limpeza ({stats.cleaning})
          </Button>
        </div>

        {/* Campo de Pesquisa com Zero Overlap */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
          <Input
            placeholder="Pesquisar quarto ou hóspede..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 text-xs rounded-xl bg-[#FAF7F2] dark:bg-[#1E1714] border-[#E5DFD6] dark:border-[#382D26] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus-visible:ring-[#BA5A1A]"
          />
        </div>
      </div>

      {/* Grelha de Quartos */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-[#EFEBE4]/60 dark:bg-[#261D19] animate-pulse border border-[#E5DFD6]/60 dark:border-[#382D26]/60" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] space-y-3">
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
              className="bg-[#BA5A1A] hover:bg-[#9C4811] text-white font-bold rounded-xl mt-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Cadastrar Primeiro Quarto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
    </div>
  );
}
