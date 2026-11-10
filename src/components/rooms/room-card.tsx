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
  QrCode,
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
import {
  computeStayRealtimeStatus,
  formatStayDuration,
  formatTimeRemaining,
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

function StayLiveSecondsCounter({
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
      <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1 truncate">
        <Clock className="h-3 w-3 text-stone-400 shrink-0" />
        Decorrido: <strong className="text-stone-800 dark:text-stone-200">{formatDurationSeconds(elapsedSeconds)}</strong>
      </span>
      <span
        className={`font-bold shrink-0 ${
          status.isOvertime
            ? 'text-rose-600 dark:text-rose-400'
            : status.isGrace
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-[#C58A2C] dark:text-[#E0852E]'
        }`}
      >
        {status.text}
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

  const isGrace = Boolean(realtime?.isGracePeriod);

  // Configuração semântica de hotelaria para cada estado
  const statusTheme = isOvertime
    ? {
        cardBorder: 'border-[#F8D2CC] dark:border-[#5E2727] shadow-[0_4px_16px_rgba(197,48,48,0.08)]',
        topAccent: 'bg-[#C53030]',
        badgeClass: 'bg-[#FDF0EE] text-[#C53030] dark:bg-[#381616] dark:text-[#FEB2B2] border border-[#FBD5D0] dark:border-[#5C2323]',
        badgeText: 'Tempo Excedido',
        Icon: AlertTriangle,
        progressClass: '[&>div]:bg-[#C53030]',
      }
    : isGrace
    ? {
        cardBorder: 'border-[#F6E0B5] dark:border-[#4E3917] shadow-[0_4px_16px_rgba(223,158,66,0.06)]',
        topAccent: 'bg-[#DF9E42]',
        badgeClass: 'bg-[#FAF4E6] text-[#975A16] dark:bg-[#322510] dark:text-[#ECC94B] border border-[#F6E0B5] dark:border-[#4E3917]',
        badgeText: 'Compensação (10 min)',
        Icon: Clock,
        progressClass: '[&>div]:bg-[#DF9E42]',
      }
    : isOccupied
    ? {
        cardBorder: 'border-[#F0D8C8] dark:border-[#423418] shadow-[0_4px_16px_rgba(186,90,26,0.06)]',
        topAccent: 'bg-[#C58A2C]',
        badgeClass: 'bg-[#FDF6E8] text-[#C58A2C] dark:bg-[#282012] dark:text-[#E8BF72] border border-[#F6E0B5] dark:border-[#54301D]',
        badgeText: 'Ocupado',
        Icon: BedDouble,
        progressClass: '[&>div]:bg-[#C58A2C]',
      }
    : isCleaning
    ? {
        cardBorder: 'border-[#F5E2BD] dark:border-[#4E3917] shadow-[0_4px_16px_rgba(223,158,66,0.06)]',
        topAccent: 'bg-[#DF9E42]',
        badgeClass: 'bg-[#FAF4E6] text-[#975A16] dark:bg-[#322510] dark:text-[#ECC94B] border border-[#F6E0B5] dark:border-[#4E3917]',
        badgeText: 'Em Limpeza',
        Icon: Sparkles,
        progressClass: '[&>div]:bg-[#DF9E42]',
      }
    : isMaintenance
    ? {
        cardBorder: 'border-[#E5DFD6] dark:border-[#2C3440] opacity-75',
        topAccent: 'bg-[#A69B93]',
        badgeClass: 'bg-[#EFEBE4] text-[#7A726C] dark:bg-[#2A221E] dark:text-[#A69B93] border border-[#DDD6CC] dark:border-[#3D322C]',
        badgeText: 'Manutenção',
        Icon: Wrench,
        progressClass: '[&>div]:bg-[#A69B93]',
      }
    : {
        cardBorder: 'border-[#D6E8DB] dark:border-[#2C4835] shadow-[0_4px_16px_rgba(72,140,100,0.05)]',
        topAccent: 'bg-[#488C64]',
        badgeClass: 'bg-[#EDF6F0] text-[#245D3B] dark:bg-[#1C3023] dark:text-[#8CD9A9] border border-[#CDE5D5] dark:border-[#284934]',
        badgeText: 'Livre',
        Icon: CheckCircle2,
        progressClass: '[&>div]:bg-[#488C64]',
      };

  // Progresso do tempo da estadia
  const totalContractedMinutes = stay
    ? ((Number(stay.contractedHours) || 1) + (stay.extensions || []).reduce((s, e) => s + (Number(e.hours) || 0), 0)) * 60
    : 60;
  const elapsedMinutes = realtime?.durationMinutes || 0;
  const progressPercent = Math.min(100, Math.round((elapsedMinutes / totalContractedMinutes) * 100));

  const StatusIcon = statusTheme.Icon;

  return (
    <Card className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-[#FFFDF9] dark:bg-[#191E25] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${statusTheme.cardBorder}`}>
      {/* Faixa superior nobre com a cor do estado */}
      <div className={`h-1.5 w-full ${statusTheme.topAccent}`} />

      <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* Cabeçalho do Cartão: Quarto, Tipo e Badge */}
        <div>
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-headline font-bold text-base sm:text-lg text-[#251D18] dark:text-[#F5EFEB] leading-tight whitespace-nowrap">
                  {room.name}
                </h3>
                {room.type && (
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0 h-4 border-[#E5DFD6] dark:border-[#2C3440] text-stone-600 dark:text-stone-300 bg-[#F8F5EE] dark:bg-[#1E242D] shrink-0">
                    {room.type}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium truncate">
                {formatCurrency(room.ratePerHour)}/hora (mín. {room.minimumHours || 1}h)
              </p>
            </div>

            {/* Badge de Estado e Menu */}
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={`text-xs font-bold px-2 py-0.5 flex items-center gap-1 rounded-full shadow-none whitespace-nowrap ${statusTheme.badgeClass}`}>
                <StatusIcon className="h-3 w-3" />
                {statusTheme.badgeText}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-[#FFFDF9] dark:bg-[#191E25] border-[#E5DFD6] dark:border-[#2C3440]">
                  {onShowQrCode && (
                    <DropdownMenuItem onClick={() => onShowQrCode(room)} className="cursor-pointer flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-[#C58A2C]" />
                      <span>QR Code & Visor do Quarto</span>
                    </DropdownMenuItem>
                  )}
                  {isManager && (
                    <>
                      <DropdownMenuItem onClick={() => onEditRoom(room)} className="cursor-pointer">
                        Editar Quarto
                      </DropdownMenuItem>
                      {isMaintenance ? (
                        <DropdownMenuItem onClick={() => updateRoom(room.id, { status: 'free' })} className="cursor-pointer">
                          Marcar como Ativo
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => updateRoom(room.id, { status: 'maintenance' })} className="cursor-pointer">
                          Colocar em Manutenção
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-[#E5DFD6] dark:bg-[#382D26]" />
                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-700 cursor-pointer"
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
            <div className="mt-3 p-3 rounded-xl bg-[#F8F5EE] dark:bg-[#1E242D] border border-[#EBE3D5] dark:border-[#382B24] space-y-2 text-xs">
              {/* Informações do Hóspede */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-bold text-stone-900 dark:text-stone-100 truncate flex items-center gap-1.5 min-w-0">
                  <User className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{stay.clientName || 'Hóspede Particular'}</span>
                </span>
                {stay.clientPhone && (
                  <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1 font-mono text-[11px] shrink-0">
                    <Phone className="h-3 w-3 text-stone-400" />
                    {stay.clientPhone}
                  </span>
                )}
              </div>

              {/* Horários de Entrada e Saída Prevista */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EBE3D5] dark:border-[#382B24] text-stone-600 dark:text-stone-300">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">Entrada:</span>
                  <span className="font-medium text-stone-900 dark:text-stone-100">
                    {normalizeDate(stay.checkInAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">Saída Prevista:</span>
                  <span className={`font-bold ${isOvertime ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'}`}>
                    {realtime.expectedCheckOut.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Resumo de Consumos do Bar se houver */}
              {(stay.consumptions && stay.consumptions.length > 0) ? (
                <div className="flex items-center justify-between text-[11px] bg-[#FFFBF0] dark:bg-[#2E2214] text-[#975A16] dark:text-[#ECC94B] p-2 rounded-lg border border-[#F6E0B5] dark:border-[#4E3917]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Wine className="h-3.5 w-3.5 text-[#DF9E42]" />
                    Consumos Bar ({stay.consumptions.length})
                  </span>
                  <span className="font-bold">
                    +{formatCurrency(stay.consumptions.reduce((s, c) => s + (Number(c.totalPrice) || 0), 0))}
                  </span>
                </div>
              ) : null}

              {/* Barra de Progresso e Alerta de Tempo */}
              <div className="space-y-1 pt-1">
                <StayLiveSecondsCounter
                  checkInAt={stay.checkInAt}
                  expectedCheckOut={realtime.expectedCheckOut}
                  graceMinutes={10}
                />
                <Progress
                  value={progressPercent}
                  className={`h-1.5 bg-[#EAE4D9] dark:bg-[#382D26] ${statusTheme.progressClass}`}
                />
              </div>

              {isOvertime && (
                <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-[#FDF0EE] dark:bg-[#381616] p-1.5 rounded-md text-center border border-[#FBD5D0] dark:border-[#5C2323]">
                  Tempo excedido · Hora adicional a faturar no check-out
                </div>
              )}
            </div>
          )}

          {isCleaning && (
            <div className="mt-3 p-3 rounded-xl bg-[#FFFBF0] dark:bg-[#2A2012] border border-[#F6E0B5] dark:border-[#4E3917] text-xs text-[#975A16] dark:text-[#ECC94B] flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-[#DF9E42] shrink-0" />
              <div>
                <p className="font-bold">Higienização e Troca de Roupa</p>
                <p className="text-[11px] text-[#A66D24] dark:text-[#D5B038] mt-0.5">
                  Tempo estimado: {room.cleaningDurationMinutes || 15} minutos.
                </p>
              </div>
            </div>
          )}

          {isFree && (
            <div className="mt-3 p-3 rounded-xl bg-[#EDF6F0] dark:bg-[#1C3023] border border-[#CDE5D5] dark:border-[#284934] text-xs text-[#245D3B] dark:text-[#8CD9A9] flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-[#488C64] shrink-0" />
              <span className="font-medium">Quarto pronto e higienizado para receber hóspede.</span>
            </div>
          )}

          {isMaintenance && (
            <div className="mt-3 p-3 rounded-xl bg-[#EFEBE4] dark:bg-[#2A221E] text-xs text-stone-600 dark:text-stone-300 border border-[#DDD6CC] dark:border-[#3D322C] flex items-center gap-2.5">
              <Wrench className="h-4 w-4 text-stone-500 shrink-0" />
              <span>Temporariamente indisponível para manutenção.</span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações Rápidas Padronizadas */}
        <div className="pt-2">
          {isFree && (
            <Button
              className="w-full bg-[#C58A2C] hover:bg-[#A87019] text-white font-bold h-10 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
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
                className="h-9 text-[11px] font-semibold border-[#DF9E42] text-[#975A16] dark:text-[#ECC94B] bg-[#FFFBF0] dark:bg-[#2A2012] hover:bg-[#FDF0D5] rounded-xl flex items-center justify-center gap-1 px-1"
                onClick={() => onConsumption(room, stay)}
                title="Lançar consumo do bar/restaurante"
              >
                <Wine className="h-3 w-3 text-[#DF9E42]" />
                + Bar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[11px] font-semibold border-[#E5DFD6] dark:border-[#2C3440] bg-[#FAF7F2] dark:bg-[#251D18] text-stone-700 dark:text-stone-200 hover:bg-[#F1EDE5] dark:hover:bg-[#302520] rounded-xl flex items-center justify-center gap-1 px-1"
                onClick={() => onExtend(room, stay)}
                title="Prorrogar tempo da estadia"
              >
                <Clock className="h-3 w-3 text-[#C58A2C]" />
                +1h
              </Button>
              <Button
                size="sm"
                className={`h-9 text-[11px] font-bold text-white shadow-sm rounded-xl flex items-center justify-center gap-1 px-1 ${
                  isOvertime ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#251D18] hover:bg-[#18120F] dark:bg-[#382D26] dark:hover:bg-[#4A3C33]'
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
              className="w-full bg-[#DF9E42] hover:bg-[#C97920] text-white font-bold h-10 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
              onClick={() => markRoomCleaned(room.id)}
            >
              <Sparkles className="h-4 w-4" />
              Concluir Limpeza (Libertar)
            </Button>
          )}

          {isMaintenance && (
            <Button
              variant="outline"
              className="w-full h-10 text-xs font-semibold rounded-xl border-[#E5DFD6] dark:border-[#2C3440]"
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
