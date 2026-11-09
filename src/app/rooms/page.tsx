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
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <BedDouble className="h-7 w-7" />
            </div>
            Quadro de Quartos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão de ocupação por hora, faturação e controlo anti-desvios em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshRealtimeStatuses}
            title="Atualizar status dos quartos"
            className="h-10 text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>

          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenNewRoom}
              className="h-10 text-xs gap-1.5 border-slate-300 dark:border-slate-700 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Quarto
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleOpenCheckIn()}
            className="h-10 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Check-in
          </Button>
        </div>
      </div>

      {/* Cartões de Indicadores (KPIs do topo) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* Livres */}
        <div
          onClick={() => setActiveTab('free')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'free'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Livres</p>
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                {stats.free}
              </p>
            </div>
          </div>
        </div>

        {/* Ocupados */}
        <div
          onClick={() => setActiveTab('occupied')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'occupied'
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/60 dark:bg-blue-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Ocupados</p>
              <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">
                {stats.occupied}
              </p>
            </div>
          </div>
        </div>

        {/* Tempo Excedido */}
        <div
          onClick={() => setActiveTab('overtime')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
            stats.overtime > 0 ? 'animate-pulse' : ''
          } ${
            activeTab === 'overtime'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/60 dark:bg-rose-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stats.overtime > 0 ? 'bg-rose-200 dark:bg-rose-900 text-rose-700' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Excedidos</p>
              <p className={`text-2xl font-extrabold ${stats.overtime > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {stats.overtime}
              </p>
            </div>
          </div>
        </div>

        {/* Em Limpeza */}
        <div
          onClick={() => setActiveTab('cleaning')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'cleaning'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/60 dark:bg-amber-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Em Limpeza</p>
              <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">
                {stats.cleaning}
              </p>
            </div>
          </div>
        </div>

        {/* Receita das Estadias de Hoje */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Faturado Hoje</p>
              <p className="text-lg font-black text-slate-900 dark:text-white truncate">
                {formatCurrency(stats.revenueToday)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Abas Rápidas */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <Button
            size="sm"
            variant={activeTab === 'all' ? 'default' : 'ghost'}
            className="text-xs font-semibold h-9 rounded-lg"
            onClick={() => setActiveTab('all')}
          >
            Todos ({rooms.length})
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'free' ? 'default' : 'ghost'}
            className="text-xs font-semibold h-9 rounded-lg gap-1.5 text-emerald-600 hover:text-emerald-700"
            onClick={() => setActiveTab('free')}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Livres ({stats.free})
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'occupied' ? 'default' : 'ghost'}
            className="text-xs font-semibold h-9 rounded-lg gap-1.5 text-blue-600 hover:text-blue-700"
            onClick={() => setActiveTab('occupied')}
          >
            <BedDouble className="h-3.5 w-3.5" />
            Ocupados ({stats.occupied})
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'overtime' ? 'default' : 'ghost'}
            className={`text-xs font-semibold h-9 rounded-lg gap-1.5 ${
              stats.overtime > 0
                ? 'text-rose-600 hover:text-rose-700 font-bold'
                : 'text-slate-600'
            }`}
            onClick={() => setActiveTab('overtime')}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Excedidos ({stats.overtime})
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'cleaning' ? 'default' : 'ghost'}
            className="text-xs font-semibold h-9 rounded-lg gap-1.5 text-amber-600 hover:text-amber-700"
            onClick={() => setActiveTab('cleaning')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Limpeza ({stats.cleaning})
          </Button>
        </div>

        {/* Caixa de Pesquisa */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Pesquisar quarto ou hóspede..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Grelha de Quartos */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
            <BedDouble className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">
            Nenhum quarto encontrado
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {searchTerm
              ? 'Nenhum quarto corresponde à pesquisa efetuada.'
              : activeTab !== 'all'
              ? 'Não existem quartos no estado selecionado neste momento.'
              : 'Ainda não cadastrou quartos no seu alojamento.'}
          </p>
          {isManager && activeTab === 'all' && !searchTerm && (
            <Button onClick={handleOpenNewRoom} className="mt-2 text-xs font-semibold gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar Primeiro Quarto
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
                onCheckIn={(r) => handleOpenCheckIn(r)}
                onExtend={(r, s) => handleOpenExtend(r, s)}
                onCheckOut={(r, s) => handleOpenCheckOut(r, s)}
                onEditRoom={(r) => handleOpenEditRoom(r)}
              />
            );
          })}
        </div>
      )}

      {/* Diálogos / Modais */}
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
    </div>
  );
}
