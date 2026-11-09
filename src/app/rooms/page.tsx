'use client';

import React, { useState, useMemo } from 'react';
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
import type { Room, Stay } from '@/lib/types';

type FilterTab = 'all' | 'free' | 'occupied' | 'overtime' | 'cleaning';

export default function RoomsPage() {
  const { rooms, openStays, stays, loading, stats, refreshRealtimeStatuses } = useRooms();
  const { user } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState<Room | null>(null);

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

  // Ações dos modais
  const handleOpenCheckIn = (room?: Room) => {
    setSelectedRoomForCheckIn(room || null);
    setCheckInOpen(true);
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
      {/* Cabeçalho da Página em Estilo Hotel Boutique */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-extrabold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <BedDouble className="h-6 w-6" />
            </div>
            Quadro de Quartos & Suítes
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 font-medium">
            Gestão de estadias em tempo real, cobrança por hora ou pernoita e controlo de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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

      {/* Cartões de Indicadores (KPIs do topo) em Estilo Hotelaria Nobre */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* Livres */}
        <div
          onClick={() => setActiveTab('free')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'free'
              ? 'border-[#488C64] ring-2 ring-[#488C64]/20 bg-[#EDF6F0] dark:bg-[#1C3023]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#488C64]/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#EDF6F0] text-[#245D3B] dark:bg-[#1C3023] dark:text-[#8CD9A9]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">Livres</p>
              <p className="text-2xl font-headline font-black text-[#245D3B] dark:text-[#8CD9A9]">
                {stats.free}
              </p>
            </div>
          </div>
        </div>

        {/* Ocupados */}
        <div
          onClick={() => setActiveTab('occupied')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'occupied'
              ? 'border-[#BA5A1A] ring-2 ring-[#BA5A1A]/20 bg-[#FAF0E6] dark:bg-[#341F14]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#BA5A1A]/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FAF0E6] text-[#BA5A1A] dark:bg-[#341F14] dark:text-[#F3B080]">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">Ocupados</p>
              <p className="text-2xl font-headline font-black text-[#BA5A1A] dark:text-[#F3B080]">
                {stats.occupied}
              </p>
            </div>
          </div>
        </div>

        {/* Tempo Excedido */}
        <div
          onClick={() => setActiveTab('overtime')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'overtime'
              ? 'border-[#C53030] ring-2 ring-[#C53030]/20 bg-[#FDF0EE] dark:bg-[#381616]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#C53030]/50'
          } ${stats.overtime > 0 ? 'animate-pulse' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stats.overtime > 0 ? 'bg-[#FDF0EE] text-[#C53030] dark:bg-[#381616] dark:text-[#FEB2B2]' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">Excedidos</p>
              <p className={`text-2xl font-headline font-black ${stats.overtime > 0 ? 'text-[#C53030] dark:text-[#FEB2B2]' : 'text-stone-700 dark:text-stone-300'}`}>
                {stats.overtime}
              </p>
            </div>
          </div>
        </div>

        {/* Em Limpeza */}
        <div
          onClick={() => setActiveTab('cleaning')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'cleaning'
              ? 'border-[#DF9E42] ring-2 ring-[#DF9E42]/20 bg-[#FAF4E6] dark:bg-[#322510]'
              : 'border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] hover:border-[#DF9E42]/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FAF4E6] text-[#975A16] dark:bg-[#322510] dark:text-[#ECC94B]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">Limpeza</p>
              <p className="text-2xl font-headline font-black text-[#975A16] dark:text-[#ECC94B]">
                {stats.cleaning}
              </p>
            </div>
          </div>
        </div>

        {/* Faturado Hoje */}
        <div className="p-4 rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FFFBF0] text-[#BA5A1A] dark:bg-[#2A2012] dark:text-[#DF9E42]">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">Faturado Hoje</p>
              <p className="text-xl font-headline font-black text-stone-900 dark:text-stone-100 truncate">
                {formatCurrency(stats.revenueToday)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa Harmonizada */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#FFFDF9] dark:bg-[#201915] p-2.5 rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] shadow-sm">
        {/* Abas Rápidas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <Button
            size="sm"
            variant="ghost"
            className={`text-xs font-semibold h-9 rounded-xl transition-all ${
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
            className={`text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
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
            className={`text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
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
            className={`text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
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
            className={`text-xs font-semibold h-9 rounded-xl gap-1.5 transition-all ${
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

        {/* Campo de Pesquisa */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <Input
            placeholder="Pesquisar quarto ou hóspede..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-[#FAF7F2] dark:bg-[#1E1714] border-[#E5DFD6] dark:border-[#382D26] text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
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
        <div className="text-center py-16 bg-[#FFFDF9] dark:bg-[#201915] rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] shadow-sm">
          <BedDouble className="h-12 w-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
          <h3 className="font-headline font-bold text-lg text-stone-800 dark:text-stone-200">
            Nenhum quarto encontrado
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Não foram encontrados quartos para a pesquisa "${searchTerm}".`
              : activeTab !== 'all'
              ? 'Não existem quartos com o filtro selecionado no momento.'
              : 'Ainda não cadastrou quartos no sistema.'}
          </p>
          {isManager && rooms.length === 0 && (
            <Button
              onClick={handleOpenNewRoom}
              className="mt-4 bg-[#BA5A1A] hover:bg-[#9C4811] text-white font-bold rounded-xl text-xs h-9"
            >
              <Plus className="h-4 w-4 mr-1" />
              Cadastrar Primeiro Quarto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              stay={staysByRoomId.get(room.id)}
              onCheckIn={handleOpenCheckIn}
              onExtend={handleOpenExtend}
              onCheckOut={handleOpenCheckOut}
              onConsumption={handleOpenConsumption}
              onEditRoom={handleOpenEditRoom}
            />
          ))}
        </div>
      )}

      {/* Modais de Operação de Hotelaria */}
      <CheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        preselectedRoomId={selectedRoomForCheckIn?.id}
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
        room={roomForConsumption}
        stay={stayForConsumption}
      />
    </div>
  );
}
