'use client';

import React from 'react';
import {
  BedDouble,
  Clock,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Plus,
  LogOut,
  MoreVertical,
  Wrench,
  User,
  Phone,
  Wine,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils';
import type { Room, Stay } from '@/lib/types';
import { computeStayRealtimeStatus, formatStayDuration, formatTimeRemaining, normalizeDate } from '@/lib/hospitality-calc';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';

interface RoomCardProps {
  room: Room;
  stay?: Stay;
  onCheckIn: (room: Room) => void;
  onExtend: (room: Room, stay: Stay) => void;
  onCheckOut: (room: Room, stay: Stay) => void;
  onConsumption: (room: Room, stay: Stay) => void;
  onEditRoom: (room: Room) => void;
}

export function RoomCard({
  room,
  stay,
  onCheckIn,
  onExtend,
  onCheckOut,
  onConsumption,
  onEditRoom,
}: RoomCardProps) {
  const { markRoomCleaned, updateRoom, deleteRoom } = useRooms();
  const { user } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';

  const realtime = stay
    ? computeStayRealtimeStatus({
        status: stay.status,
        checkInAt: stay.checkInAt,
        contractedHours: stay.contractedHours,
        extensions: stay.extensions,
        now: new Date(),
      })
    : null;

  // Determinar o status efetivo do quarto
  const isOvertime = room.status === 'overtime' || (realtime?.isOvertime && room.status === 'occupied');
  const isOccupied = room.status === 'occupied' && !isOvertime;
  const isCleaning = room.status === 'cleaning';
  const isFree = room.status === 'free';
  const isMaintenance = room.status === 'maintenance';

  // Cores de contorno e fundo conforme o status
  const cardBorderClass = isOvertime
    ? 'border-rose-400 dark:border-rose-700 bg-rose-50/30 dark:bg-rose-950/20 shadow-rose-100 dark:shadow-none'
    : isOccupied
    ? 'border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-sm'
    : isCleaning
    ? 'border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm'
    : isMaintenance
    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 opacity-80'
    : 'border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-900 shadow-sm';

  // Progresso do tempo da estadia
  const totalContractedMinutes = stay
    ? ((Number(stay.contractedHours) || 1) + (stay.extensions || []).reduce((s, e) => s + (Number(e.hours) || 0), 0)) * 60
    : 60;
  const elapsedMinutes = realtime?.durationMinutes || 0;
  const progressPercent = Math.min(100, Math.round((elapsedMinutes / totalContractedMinutes) * 100));

  return (
    <Card className={`relative flex flex-col justify-between overflow-hidden border-2 transition-all duration-200 hover:shadow-md ${cardBorderClass}`}>
      {/* Faixa superior colorida indicativa */}
      <div
        className={`h-1.5 w-full ${
          isOvertime
            ? 'bg-rose-500 animate-pulse'
            : isOccupied
            ? 'bg-blue-500'
            : isCleaning
            ? 'bg-amber-500'
            : isMaintenance
            ? 'bg-slate-400'
            : 'bg-emerald-500'
        }`}
      />

      <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* Cabeçalho do Cartão: Nome do Quarto + Badges + Menu */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-tight">
                  {room.name}
                </h3>
                {room.type && (
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0 h-4 border-slate-300 dark:border-slate-700">
                    {room.type}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatCurrency(room.ratePerHour)}/hora (mín. {room.minimumHours || 1}h)
              </p>
            </div>

            {/* Status Badge & Opções */}
            <div className="flex items-center gap-1">
              {isOvertime && (
                <Badge className="bg-rose-600 hover:bg-rose-600 text-white font-bold text-xs uppercase px-2 py-0.5 animate-pulse shadow-sm flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Excedido
                </Badge>
              )}
              {isOccupied && (
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-semibold text-xs uppercase px-2 py-0.5">
                  Ocupado
                </Badge>
              )}
              {isCleaning && (
                <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-semibold text-xs uppercase px-2 py-0.5 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Limpeza
                </Badge>
              )}
              {isFree && (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold text-xs uppercase px-2 py-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Livre
                </Badge>
              )}
              {isMaintenance && (
                <Badge variant="secondary" className="text-xs uppercase px-2 py-0.5 flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  Manutenção
                </Badge>
              )}

              {/* Menu de Gestão para Administradores */}
              {isManager && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onEditRoom(room)}>
                      Editar Quarto
                    </DropdownMenuItem>
                    {isMaintenance ? (
                      <DropdownMenuItem onClick={() => updateRoom(room.id, { status: 'free' })}>
                        Marcar como Ativo
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => updateRoom(room.id, { status: 'maintenance' })}>
                        Colocar em Manutenção
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-600"
                      onClick={() => {
                        if (confirm(`Tem a certeza que deseja eliminar o ${room.name}?`)) {
                          deleteRoom(room.id);
                        }
                      }}
                    >
                      Eliminar Quarto
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Conteúdo Conforme o Estado */}
          {(isOccupied || isOvertime) && stay && realtime && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
              {/* Informações do Hóspede */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {stay.clientName || 'Hóspede Particular'}
                </span>
                {stay.clientPhone && (
                  <span className="text-slate-500 flex items-center gap-0.5">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {stay.clientPhone}
                  </span>
                )}
              </div>

              {/* Horários de Entrada e Saída Prevista */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-[11px] text-slate-500 block">Entrada:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {normalizeDate(stay.checkInAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Saída Prevista:</span>
                  <span className={`font-semibold ${isOvertime ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {realtime.expectedCheckOut.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Resumo de Consumos do Bar se houver */}
              {(stay.consumptions && stay.consumptions.length > 0) ? (
                <div className="flex items-center justify-between text-[11px] bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-1.5 rounded-md border border-amber-200/60 dark:border-amber-900/40">
                  <span className="flex items-center gap-1 font-medium">
                    <Wine className="h-3 w-3 text-amber-600" />
                    Bar: {stay.consumptions.length} {stay.consumptions.length === 1 ? 'item' : 'itens'}
                  </span>
                  <span className="font-bold">
                    +{formatCurrency(stay.consumptions.reduce((s, c) => s + (Number(c.totalPrice) || 0), 0))}
                  </span>
                </div>
              ) : null}

              {/* Barra de Progresso e Alerta de Tempo */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    Decorrido: {formatStayDuration(elapsedMinutes)}
                  </span>
                  <span className={`font-bold ${isOvertime ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {formatTimeRemaining(realtime.minutesRemainingOrOverdue)}
                  </span>
                </div>
                <Progress
                  value={progressPercent}
                  className={`h-1.5 ${isOvertime ? '[&>div]:bg-rose-600' : '[&>div]:bg-blue-600'}`}
                />
              </div>

              {/* Alerta Adicional se Overtime */}
              {isOvertime && (
                <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/50 p-1.5 rounded text-center">
                  Hora começada = hora completa a faturar no check-out!
                </div>
              )}
            </div>
          )}

          {isCleaning && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-semibold">Higienização e Troca de Roupa</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Tempo estimado: {room.cleaningDurationMinutes || 15} minutos.
                </p>
              </div>
            </div>
          )}

          {isFree && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Pronto e higienizado para receber novo hóspede.</span>
            </div>
          )}

          {isMaintenance && (
            <div className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-500 shrink-0" />
              <span>Quarto temporariamente indisponível para manutenção.</span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações Rápidas */}
        <div className="pt-2">
          {isFree && (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 shadow-sm flex items-center justify-center gap-1.5"
              onClick={() => onCheckIn(room)}
            >
              <Plus className="h-4 w-4" />
              Fazer Check-in
            </Button>
          )}

          {(isOccupied || isOvertime) && stay && (
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[11px] font-semibold border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-center gap-1 px-1"
                onClick={() => onConsumption(room, stay)}
                title="Lançar consumo do bar/restaurante"
              >
                <Wine className="h-3 w-3 text-amber-600" />
                + Bar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[11px] font-semibold border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center justify-center gap-1 px-1"
                onClick={() => onExtend(room, stay)}
                title="Prorrogar tempo da estadia"
              >
                <Clock className="h-3 w-3 text-blue-500" />
                +1h
              </Button>
              <Button
                size="sm"
                className={`h-9 text-[11px] font-bold text-white shadow-sm flex items-center justify-center gap-1 px-1 ${
                  isOvertime ? 'bg-rose-600 hover:bg-rose-700 animate-pulse' : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
                }`}
                onClick={() => onCheckOut(room, stay)}
              >
                <LogOut className="h-3 w-3" />
                Saída
              </Button>
            </div>
          )}

          {isCleaning && (
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold h-10 shadow-sm flex items-center justify-center gap-1.5"
              onClick={() => markRoomCleaned(room.id)}
            >
              <Sparkles className="h-4 w-4" />
              Concluir Limpeza (Libertar)
            </Button>
          )}

          {isMaintenance && (
            <Button
              variant="outline"
              className="w-full h-10 text-xs font-semibold"
              onClick={() => updateRoom(room.id, { status: 'free' })}
            >
              Reativar Quarto
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
