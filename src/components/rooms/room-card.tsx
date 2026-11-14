'use client';

import React from 'react';
import {
  BedDouble,
  Clock,
  AlertTriangle,
  Brush,
  CheckCircle2,
  Plus,
  LogOut,
  MoreVertical,
  Wrench,
  User,
  Phone,
  Wine,
  QrCode,
  KeyRound,
  Car,
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
import { formatCurrency, cn } from '@/lib/utils';
import type { Room, Stay } from '@/lib/types';
import {
  computeStayRealtimeStatus,
  computeRoomCleaningStatus,
  formatDurationSeconds,
  formatTimeRemainingSeconds,
  normalizeDate,
} from '@/lib/hospitality-calc';
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
  onShowQrCode?: (room: Room) => void;
}

export function StayLiveSecondsCounter({
  checkInAt,
  expectedCheckOut,
  graceMinutes = 10,
}: {
  checkInAt: any;
  expectedCheckOut: Date;
  graceMinutes?: number;
}) {
  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkInMs = normalizeDate(checkInAt).getTime();
  const elapsedSeconds = Math.max(0, Math.floor((now - checkInMs) / 1000));
  const expectedMs = normalizeDate(expectedCheckOut).getTime();
  const diffSeconds = Math.floor((expectedMs - now) / 1000);

  const status = formatTimeRemainingSeconds(diffSeconds, graceMinutes);

  return (
    <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
        Decorrido: <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{formatDurationSeconds(elapsedSeconds)}</strong>
      </span>
      <span
        className={cn(
          'font-extrabold shrink-0',
          status.isOvertime
            ? 'text-rose-600 dark:text-rose-400'
            : status.isGrace
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-[#007bb9] dark:text-sky-400'
        )}
      >
        {status.text}
      </span>
    </div>
  );
}


export function CleaningLiveSecondsCounter({
  cleaningStartedAt,
  maxMinutes = 15,
}: {
  cleaningStartedAt: any;
  maxMinutes?: number;
}) {
  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const startedMs = normalizeDate(cleaningStartedAt).getTime();
  const elapsedSeconds = Math.max(0, Math.floor((now - startedMs) / 1000));
  const maxSeconds = Math.max(1, maxMinutes) * 60;
  const isDelayed = elapsedSeconds > maxSeconds;
  const overdueSeconds = isDelayed ? elapsedSeconds - maxSeconds : 0;

  return (
    <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
        <Brush className={cn("h-3 w-3 shrink-0", isDelayed ? "text-amber-500" : "text-sky-500")} />
        Decorrido: <strong className={cn("font-extrabold", isDelayed ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-slate-200")}>{formatDurationSeconds(elapsedSeconds)}</strong>
      </span>
      <span
        className={cn(
          'font-extrabold shrink-0',
          isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'
        )}
      >
        {isDelayed ? `+${formatDurationSeconds(overdueSeconds)} atraso` : `Limite: ${maxMinutes}m`}
      </span>
    </div>
  );
}

export function RoomCard({
  room,
  stay,
  onCheckIn,
  onExtend,
  onCheckOut,
  onConsumption,
  onEditRoom,
  onShowQrCode,
}: RoomCardProps) {
  const { markRoomCleaned, updateRoom, deleteRoom } = useRooms();
  const { user, companyData, companyId } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';
  const isGuest = !companyId || companyId === 'guest' || companyId.startsWith('guest_');

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

  const isGrace = Boolean(realtime?.isGracePeriod);

  const cleaningStatus = isCleaning
    ? computeRoomCleaningStatus({
        cleaningStartedAt: room.cleaningStartedAt,
        cleaningDurationMinutes: room.cleaningDurationMinutes,
        companyAlertMinutes: companyData?.notificationSettings?.cleaningAlertMinutes,
        now: new Date(),
      })
    : null;

  const isCleaningDelayed = Boolean(isCleaning && cleaningStatus?.isDelayed);

  // Configuração semântica Stitch para cada estado
  const statusTheme = isOvertime
    ? {
        cardBorder: 'border-rose-200 dark:border-rose-900/60 shadow-[0_4px_20px_rgba(244,63,94,0.08)]',
        topAccent: 'bg-gradient-to-r from-rose-500 to-red-600',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800',
        badgeText: 'Tempo Excedido',
        Icon: AlertTriangle,
        progressClass: '[&>div]:bg-rose-500',
      }
    : isGrace
    ? {
        cardBorder: 'border-amber-200 dark:border-amber-900/60 shadow-[0_4px_20px_rgba(245,158,11,0.08)]',
        topAccent: 'bg-gradient-to-r from-amber-400 to-amber-500',
        badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800',
        badgeText: 'Compensação (10 min)',
        Icon: Clock,
        progressClass: '[&>div]:bg-amber-500',
      }
    : isOccupied
    ? {
        cardBorder: 'border-blue-200/80 dark:border-blue-900/50 shadow-card hover:border-blue-300',
        topAccent: 'bg-gradient-to-r from-[#0091da] to-[#007bb9]',
        badgeClass: 'bg-blue-50 text-[#007bb9] dark:bg-blue-950/50 dark:text-sky-300 border border-blue-200/80 dark:border-blue-800',
        badgeText: 'Ocupado',
        Icon: BedDouble,
        progressClass: '[&>div]:bg-[#007bb9]',
      }
    : isCleaningDelayed
    ? {
        cardBorder: 'border-amber-300 dark:border-amber-900/70 shadow-[0_4px_20px_rgba(245,158,11,0.12)]',
        topAccent: 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500',
        badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
        badgeText: `Limpeza Atrasada (+${cleaningStatus?.overdueMinutes || 0}m)`,
        Icon: AlertTriangle,
        progressClass: '[&>div]:bg-amber-500',
      }
    : isCleaning
    ? {
        cardBorder: 'border-sky-200 dark:border-sky-900/50 shadow-card',
        topAccent: 'bg-gradient-to-r from-sky-400 to-blue-500',
        badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800',
        badgeText: 'Em Limpeza',
        Icon: Brush,
        progressClass: '[&>div]:bg-sky-500',
      }
    : isMaintenance
    ? {
        cardBorder: 'border-slate-200 dark:border-slate-800 opacity-75',
        topAccent: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        badgeText: 'Manutenção',
        Icon: Wrench,
        progressClass: '[&>div]:bg-slate-400',
      }
    : {
        cardBorder: 'border-emerald-200/80 dark:border-emerald-900/50 shadow-card hover:border-emerald-300',
        topAccent: 'bg-gradient-to-r from-emerald-400 to-teal-500',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800',
        badgeText: 'Livre',
        Icon: CheckCircle2,
        progressClass: '[&>div]:bg-emerald-500',
      };

  // Progresso do tempo da estadia
  const totalContractedMinutes = stay
    ? ((Number(stay.contractedHours) || 1) + (stay.extensions || []).reduce((s, e) => s + (Number(e.hours) || 0), 0)) * 60
    : 60;
  const elapsedMinutes = realtime?.durationMinutes || 0;
  const progressPercent = Math.min(100, Math.round((elapsedMinutes / totalContractedMinutes) * 100));

  const StatusIcon = statusTheme.Icon;
  const stayPin = stay?.accessPin || (isGuest ? '1234' : 'PIN indisponível');

  return (
    <Card className={cn(
      'relative flex flex-col justify-between min-w-0 w-full overflow-hidden rounded-3xl border bg-white dark:bg-[#191E25] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-hover',
      statusTheme.cardBorder
    )}>
      {/* Faixa superior nobre com a cor do estado */}
      <div className={cn('h-1.5 w-full', statusTheme.topAccent)} />

      <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5">
        {/* Cabeçalho do Cartão: Quarto, Tipo e Badge */}
        <div>
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight break-words">
                {room.name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <Badge className={cn('text-xs font-bold px-2.5 py-0.5 flex items-center gap-1.5 rounded-full shadow-none whitespace-nowrap', statusTheme.badgeClass)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusTheme.badgeText}
                </Badge>
                {room.type && (
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 h-5 rounded-full border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 shrink-0">
                    {room.type}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-semibold">
                {formatCurrency(room.ratePerHour)}/hora (mín. {room.minimumHours || 1}h)
              </p>
            </div>

            {/* Badge de Estado e Menu */}
            <div className="flex items-center gap-0.5 shrink-0">
              {onShowQrCode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onShowQrCode(room)}
                  title="Ver QR Code e PIN do Quarto"
                  className="h-8 w-8 text-[#007bb9] hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-full shrink-0"
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl bg-white dark:bg-[#191E25] border-slate-200 dark:border-slate-800 shadow-xl">
                  {onShowQrCode && (
                    <DropdownMenuItem onClick={() => onShowQrCode(room)} className="cursor-pointer flex items-center gap-2 rounded-xl">
                      <QrCode className="h-4 w-4 text-[#007bb9]" />
                      <span>QR Code & Visor do Quarto</span>
                    </DropdownMenuItem>
                  )}
                  {isManager && (
                    <>
                      <DropdownMenuItem onClick={() => onEditRoom(room)} className="cursor-pointer rounded-xl">
                        Editar Quarto
                      </DropdownMenuItem>
                      {isMaintenance ? (
                        <DropdownMenuItem onClick={() => updateRoom(room.id, { status: 'free' })} className="cursor-pointer rounded-xl">
                          Marcar como Ativo
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => updateRoom(room.id, { status: 'maintenance' })} className="cursor-pointer rounded-xl">
                          Colocar em Manutenção
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-700 cursor-pointer rounded-xl"
                        onClick={() => {
                          if (confirm(`Tem a certeza que deseja eliminar o ${room.name}?`)) {
                            deleteRoom(room.id);
                          }
                        }}
                      >
                        Eliminar Quarto
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Conteúdo Conforme o Estado */}
          {(isOccupied || isOvertime) && stay && realtime && (
            <div className="mt-3.5 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs">
              {/* Informações do Hóspede */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0">
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5 min-w-0">
                  <User className="h-3.5 w-3.5 text-[#007bb9] shrink-0" />
                  <span className="truncate">{stay.clientName || 'Hóspede Particular'}</span>
                </span>
                {stay.clientPhone && (
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono text-[11px] shrink-0 font-medium">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {stay.clientPhone}
                  </span>
                )}
                {(stay.vehiclePlate || stay.vehicleBrand || stay.vehicleModel) && (
                  <span
                    className="text-slate-600 dark:text-slate-300 flex items-center gap-1 text-[11px] font-medium shrink-0 max-w-[220px] truncate"
                    title={`Viatura: ${[stay.vehiclePlate, stay.vehicleBrand, stay.vehicleModel, stay.vehicleColor].filter(Boolean).join(' · ')}`}
                  >
                    <Car className="h-3 w-3 text-[#007bb9] shrink-0" />
                    {stay.vehiclePlate && <span className="font-mono font-bold">{stay.vehiclePlate}</span>}
                    {(stay.vehicleBrand || stay.vehicleModel) && (
                      <span className="truncate text-slate-500 dark:text-slate-400 text-[10px]">
                        ({[stay.vehicleBrand, stay.vehicleModel, stay.vehicleColor].filter(Boolean).join(' ')})
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* PIN de Acesso ao Quarto */}
              <div className="flex items-center justify-between bg-blue-100/70 dark:bg-blue-950/70 px-3 py-1.5 rounded-xl border border-blue-200/90 dark:border-blue-900/60 font-medium">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#006194] dark:text-sky-300">
                  <KeyRound className="h-3.5 w-3.5 text-[#007bb9]" />
                  PIN do QR Code:
                </span>
                <span className="font-mono font-black text-sm tracking-widest bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xs">
                  {stayPin}
                </span>
              </div>

              {/* Horários de Entrada e Saída Prevista */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Entrada:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {normalizeDate(stay.checkInAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Saída Prevista:</span>
                  <span className={cn('font-bold', isOvertime ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100')}>
                    {realtime.expectedCheckOut.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Resumo de Consumos do Bar se houver */}
              {(stay.consumptions && stay.consumptions.length > 0) ? (
                <div className="flex items-center justify-between text-[11px] bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-800/50">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Wine className="h-3.5 w-3.5 text-amber-600" />
                    Consumos Bar ({stay.consumptions.length})
                  </span>
                  <span className="font-extrabold">
                    +{formatCurrency(stay.consumptions.reduce((s, c) => s + (Number(c.totalPrice) || 0), 0))}
                  </span>
                </div>
              ) : null}

              {/* Conta-Segundos em Tempo Real e Barra de Progresso */}
              <div className="space-y-1.5 pt-1">
                <StayLiveSecondsCounter
                  checkInAt={stay.checkInAt}
                  expectedCheckOut={realtime.expectedCheckOut}
                  graceMinutes={10}
                />
                <Progress
                  value={progressPercent}
                  className={cn('h-1.5 bg-slate-200/80 dark:bg-slate-800', statusTheme.progressClass)}
                />
              </div>

              {isOvertime && (
                <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 p-2 rounded-xl text-center border border-rose-200 dark:border-rose-900/50">
                  Tempo excedido · Hora adicional a faturar no check-out
                </div>
              )}
            </div>
          )}

          {isCleaningDelayed && cleaningStatus && (
            <div className="mt-3.5 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 shrink-0 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-extrabold text-amber-900 dark:text-amber-100">Limpeza Atrasada</p>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-snug">
                    Excedeu o limite de {cleaningStatus.maxMinutes} min em +{cleaningStatus.overdueMinutes} min. Notificação enviada à gerência.
                  </p>
                </div>
              </div>
              <CleaningLiveSecondsCounter
                cleaningStartedAt={room.cleaningStartedAt}
                maxMinutes={cleaningStatus.maxMinutes}
              />
              <Progress
                value={100}
                className="h-1.5 bg-amber-200/80 dark:bg-amber-900/50 [&>div]:bg-amber-500"
              />
            </div>
          )}

          {isCleaning && !isCleaningDelayed && (
            <div className="mt-3.5 p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/50 text-xs text-sky-800 dark:text-sky-300 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-sky-100 dark:bg-sky-900/50 shrink-0 text-sky-600 dark:text-sky-300">
                  <Brush className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sky-900 dark:text-sky-100">Higienização e Troca de Roupa</p>
                  <p className="text-[11px] text-sky-600 dark:text-sky-400">
                    Limite: {room.cleaningDurationMinutes || 15} minutos.
                  </p>
                </div>
              </div>
              {room.cleaningStartedAt ? (
                <>
                  <CleaningLiveSecondsCounter
                    cleaningStartedAt={room.cleaningStartedAt}
                    maxMinutes={cleaningStatus?.maxMinutes || room.cleaningDurationMinutes || 15}
                  />
                  <Progress
                    value={cleaningStatus ? Math.min(100, Math.round((cleaningStatus.durationSeconds / (cleaningStatus.maxMinutes * 60)) * 100)) : 20}
                    className="h-1.5 bg-sky-200/80 dark:bg-sky-900/50 [&>div]:bg-sky-500"
                  />
                </>
              ) : null}
            </div>
          )}

          {isFree && (
            <div className="mt-3.5 p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <span className="font-semibold">Quarto pronto e higienizado para receber hóspede.</span>
            </div>
          )}

          {isMaintenance && (
            <div className="mt-3.5 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <Wrench className="h-4 w-4 text-slate-500 shrink-0" />
              <span className="font-medium">Temporariamente indisponível para manutenção.</span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações Rápidas Padronizadas */}
        <div className="pt-2">
          {isFree && (
            <Button
              className="w-full bg-[#007bb9] hover:bg-[#006194] text-white font-extrabold h-11 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              onClick={() => onCheckIn(room)}
            >
              <Plus className="h-4 w-4" />
              Fazer Check-in
            </Button>
          )}

          {(isOccupied || isOvertime) && stay && (
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-xs font-bold border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-2xl flex items-center justify-center gap-1.5 px-2 active:scale-95 transition-all"
                onClick={() => onConsumption(room, stay)}
                title="Lançar consumo do bar/restaurante"
              >
                <Wine className="h-3.5 w-3.5 text-amber-600" />
                + Bar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-xs font-bold border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center gap-1.5 px-2 active:scale-95 transition-all"
                onClick={() => onExtend(room, stay)}
                title="Prorrogar tempo da estadia"
              >
                <Clock className="h-3.5 w-3.5 text-[#007bb9]" />
                +1h
              </Button>
              <Button
                size="sm"
                className={cn(
                  'h-10 text-xs font-extrabold text-white shadow-sm rounded-2xl flex items-center justify-center gap-1.5 px-2 active:scale-95 transition-all',
                  isOvertime
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700'
                )}
                onClick={() => onCheckOut(room, stay)}
              >
                <LogOut className="h-3.5 w-3.5" />
                Saída
              </Button>
            </div>
          )}

          {isCleaningDelayed && (
            <Button
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold h-11 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              onClick={() => markRoomCleaned(room.id)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluir Limpeza (Libertar)
            </Button>
          )}

          {isCleaning && !isCleaningDelayed && (
            <Button
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-extrabold h-11 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              onClick={() => markRoomCleaned(room.id)}
            >
              <Brush className="h-4 w-4" />
              Concluir Limpeza (Libertar)
            </Button>
          )}

          {isMaintenance && (
            <Button
              variant="outline"
              className="w-full h-11 text-xs font-bold rounded-2xl border-slate-200 dark:border-slate-800"
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
