"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BedDouble,
  Lock,
  Sparkles,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  Wine,
  Key,
} from "lucide-react";
import { useRooms } from "@/context/rooms-context";
import { useInventory } from "@/context/inventory-context";
import {
  calculateStayPricing,
  computeStayRealtimeStatus,
  computeRoomCleaningStatus,
  formatTimeRemaining,
  formatTimeRemainingSeconds,
  normalizeDate,
  totalContractedHours,
} from "@/lib/hospitality-calc";
import { lastDays, summarizeDay } from "@/lib/hospitality-dashboard";
import { cn, formatCurrency } from "@/lib/utils";

const compact = (v: number) =>
  new Intl.NumberFormat("pt-MZ", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const hhmm = (d: Date) => d.toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit" });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function DashboardStayLiveBadge({
  expectedCheckOut,
  graceMinutes = 10,
}: {
  expectedCheckOut: Date;
  graceMinutes?: number;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const expectedMs = normalizeDate(expectedCheckOut).getTime();
  const diffSeconds = Math.floor((expectedMs - now) / 1000);
  const status = formatTimeRemainingSeconds(diffSeconds, graceMinutes);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tabular-nums font-bold border shadow-2xs",
        status.isOvertime
          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/50"
          : status.isGrace
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300/80 dark:border-amber-900/50"
          : "bg-blue-50 text-[#007bb9] dark:bg-blue-950/40 dark:text-sky-300 border-blue-200/60 dark:border-blue-900/50"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          status.isOvertime
            ? "bg-rose-500 animate-ping"
            : status.isGrace
            ? "bg-amber-500 animate-ping"
            : "bg-[#007bb9] animate-ping"
        )}
      />
      {status.text}
    </span>
  );
}

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 font-headline">
        {children}
      </h2>
      {subtitle && <p className="text-[11px] text-stone-400 dark:text-stone-500">{subtitle}</p>}
    </div>
  );
}

interface TileProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "free" | "occupied" | "overtime" | "cleaning";
}

function Tile({ label, value, icon: Icon, tone = "occupied" }: TileProps) {
  const toneConfig = {
    free: {
      badgeBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-900/40",
      textCol: "text-slate-800 dark:text-slate-100",
      hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-700/60",
    },
    occupied: {
      badgeBg: "bg-blue-50 text-[#007bb9] dark:bg-blue-950/40 dark:text-sky-400 border border-blue-100/80 dark:border-blue-900/40",
      textCol: "text-[#007bb9] dark:text-sky-400",
      hoverBorder: "hover:border-blue-300 dark:hover:border-blue-700/60",
    },
    overtime: {
      badgeBg: "bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40",
      textCol: value > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100",
      hoverBorder: "hover:border-rose-300 dark:hover:border-rose-700/60",
    },
    cleaning: {
      badgeBg: "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40",
      textCol: "text-slate-800 dark:text-slate-100",
      hoverBorder: "hover:border-amber-300 dark:hover:border-amber-700/60",
    },
  }[tone];

  return (
    <Link
      href="/rooms"
      className={cn(
        "group rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#191E25] p-5 flex flex-col justify-between h-[130px] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        toneConfig.hoverBorder
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
          {label}
        </p>
        <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", toneConfig.badgeBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn("text-3xl font-headline font-extrabold leading-none", toneConfig.textCol)}>
        {value}
      </p>
    </Link>
  );
}

export function HospitalityDashboard() {
  const { rooms, openStays, stats, loading } = useRooms();
  const { user, sales, canView } = useInventory();
  const isManager = user?.role === "Admin" || user?.role === "Dono";

  // o relógio da página: os "restam / excedido há" e o valor a pagar andam com o tempo
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // O valor é o mesmo que o check-out cobraria agora (horas + consumos do bar).
  const rows = useMemo(
    () =>
      openStays
        .map((stay) => {
          const realtime = computeStayRealtimeStatus({
            status: stay.status,
            checkInAt: stay.checkInAt,
            contractedHours: stay.contractedHours,
            extensions: stay.extensions,
            now,
          });
          const pricing = calculateStayPricing({
            checkInAt: stay.checkInAt,
            checkOutAt: now,
            contractedHours: totalContractedHours(stay),
            ratePerHour: stay.ratePerHourApplied,
            consumptions: stay.consumptions,
          });
          return { stay, realtime, pricing };
        })
        .sort((a, b) => a.realtime.minutesRemainingOrOverdue - b.realtime.minutesRemainingOrOverdue),
    [openStays, now]
  );

  const today = useMemo(() => summarizeDay(sales || [], now), [sales, now]);
  const week = useMemo(() => lastDays(sales || [], now, 7), [sales, now]);
  const weekMax = Math.max(1, ...week.map((b) => b.total));
  const toReceive = rows.reduce((t, r) => t + r.pricing.totalAmountDue, 0);

  const delayedCleaningCount = useMemo(() => {
    return (rooms || []).filter((r) => {
      if (r.status !== 'cleaning' || !r.cleaningStartedAt) return false;
      const cStatus = computeRoomCleaningStatus({
        cleaningStartedAt: r.cleaningStartedAt,
        cleaningDurationMinutes: r.cleaningDurationMinutes,
        now,
      });
      return cStatus?.isDelayed;
    }).length;
  }, [rooms, now]);


  if (!canView("rooms")) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-8 text-center shadow-sm">
        <Lock strokeWidth={1.5} className="h-8 w-8 text-stone-400" />
        <p className="max-w-md text-sm text-stone-600 dark:text-stone-300 font-medium">
          Não tem permissão para aceder à gestão de quartos. Solicite acesso ao Administrador ou Dono.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#EFEBE4]/60 dark:bg-[#1E242D] border border-[#E5DFD6]/60 dark:border-[#2C3440]/60" />
          ))}
        </div>
        <div className="h-44 animate-pulse rounded-2xl bg-[#EFEBE4]/60 dark:bg-[#1E242D] border border-[#E5DFD6]/60 dark:border-[#2C3440]/60" />
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-10 text-center shadow-sm max-w-xl mx-auto my-8">
        <div className="p-4 rounded-full bg-primary/10 text-primary">
          <BedDouble strokeWidth={1.8} className="h-10 w-10" />
        </div>
        <div>
          <h3 className="text-xl font-headline font-bold text-stone-900 dark:text-stone-100">
            Ainda não cadastrou quartos
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-stone-500 dark:text-stone-400">
            Configure os seus quartos, suítes e tarifas por hora para iniciar os registos de check-in e faturação.
          </p>
        </div>
        <Link
          href="/rooms"
          className="rounded-xl bg-[#C58A2C] hover:bg-[#A87019] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all flex items-center gap-2"
        >
          Configurar Quartos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-2 sm:px-0">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#006194] via-[#007bb9] to-[#0284c7] dark:from-[#131B26] dark:via-[#182332] dark:to-[#1B293A] p-6 sm:p-7 text-white shadow-soft border border-blue-400/20 dark:border-blue-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 dark:bg-white/10 backdrop-blur-sm text-xs font-semibold mb-2 text-white">
              <span>✨ Gestão em tempo real</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Painel de Acompanhamento</h1>
            <p className="text-blue-100 dark:text-slate-300 text-xs mt-1 font-medium">
              Controlo de ocupação, estadias ativas e balanço financeiro do Major Stay.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/15 dark:bg-white/5 backdrop-blur-md rounded-2xl px-4 py-2 text-right border border-white/20 dark:border-white/10">
              <span className="text-[11px] font-semibold text-blue-100 dark:text-slate-300 block">Total Previsto a Receber</span>
              <span className="text-lg font-black tracking-tight text-white">{formatCurrency(toReceive)}</span>
            </div>
            <Link
              href="/rooms/checkin"
              className="px-4 py-2.5 rounded-2xl bg-white text-[#006194] hover:bg-blue-50 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95 shrink-0"
            >
              <Key className="w-3.5 h-3.5" />
              Novo Check-in
            </Link>
          </div>
        </div>
        {/* Decorative subtle background shapes */}
        <div className="absolute -right-8 -bottom-10 w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute left-1/2 -top-12 w-36 h-36 rounded-full bg-sky-400/20 blur-2xl pointer-events-none" />
      </div>

      {/* 1. Quartos agora */}
      <section className="flex flex-col gap-3" data-tour="hotel-rooms">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle subtitle="Disponibilidade e ocupação em tempo real">
            Quartos & Ocupação Agora
          </SectionTitle>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Livres" value={stats.free} icon={CheckCircle2} tone="free" />
          <Tile label="Ocupados" value={stats.occupied} icon={BedDouble} tone="occupied" />
          <Tile label="Tempo Excedido" value={stats.overtime} icon={AlertTriangle} tone="overtime" />
          <Tile label="Em Limpeza" value={stats.cleaning} icon={Sparkles} tone="cleaning" />
        </div>
      </section>

      {/* 2. Alertas de Hotelaria */}
      {(stats.overtime > 0 || stats.cleaning > 0) && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle>Avisos Operacionais</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.overtime > 0 && (
              <Link
                href="/rooms"
                className="flex items-center gap-3 rounded-2xl border border-[#FBD5D0] dark:border-[#5C2323] bg-[#FDF0EE] dark:bg-[#381616] p-4 text-xs font-bold text-[#C53030] dark:text-[#FEB2B2] shadow-sm hover:opacity-95 transition-all"
              >
                <div className="p-2 rounded-xl bg-[#C53030]/10 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-[#C53030]" />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {plural(stats.overtime, "quarto com tempo excedido", "quartos com tempo excedido")}
                  </p>
                  <p className="text-[11px] font-normal text-[#C53030]/80 mt-0.5">
                    Toque para abrir a lista e efetuar check-out ou prorrogação.
                  </p>
                </div>
              </Link>
            )}
            {stats.cleaning > 0 && (
              <Link
                href="/rooms"
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-4 text-xs font-bold shadow-sm hover:opacity-95 transition-all",
                  delayedCleaningCount > 0
                    ? "border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                    : "border-[#F6E0B5] dark:border-[#4E3917] bg-[#FFFBF0] dark:bg-[#2A2012] text-[#975A16] dark:text-[#ECC94B]"
                )}
              >
                <div className={cn("p-2 rounded-xl shrink-0", delayedCleaningCount > 0 ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-[#DF9E42]/15 text-[#DF9E42]")}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">
                      {plural(stats.cleaning, "quarto a aguardar limpeza", "quartos a aguardar limpeza")}
                    </p>
                    {delayedCleaningCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                        {delayedCleaningCount} ATRASADO{delayedCleaningCount > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                  <p className={cn("text-[11px] font-normal mt-0.5", delayedCleaningCount > 0 ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-[#975A16]/80")}>
                    {delayedCleaningCount > 0
                      ? `${delayedCleaningCount} quarto(s) excederam o tempo limite de higienização. Toque para verificar.`
                      : "Libertar para novos hóspedes após higienização."}
                  </p>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 3. Estadias Abertas */}
      <section className="flex flex-col gap-3" data-tour="hotel-stays">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-3">
          <SectionTitle subtitle="Hóspedes atualmente acomodados nos quartos">
            Estadias Abertas
          </SectionTitle>
          {rows.length > 0 && (
            <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#191E25] border border-slate-200/80 dark:border-slate-800 px-3.5 py-1.5 rounded-full shadow-xs flex items-center gap-1.5">
              <span>A receber agora:</span>
              <span className="font-extrabold text-[#006194] dark:text-sky-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40">
                {formatCurrency(toReceive)}
              </span>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#191E25] p-8 text-center text-xs text-slate-400 shadow-sm">
            Nenhum quarto com estadia ativa neste momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map(({ stay, realtime, pricing }, idx) => (
              <Link
                key={stay.id}
                href="/rooms"
                className={cn(
                  "flex items-center justify-between gap-3 rounded-3xl border bg-white dark:bg-[#191E25] p-5 shadow-card hover:shadow-md transition-all group",
                  realtime.isOvertime
                    ? "border-rose-200 dark:border-rose-900/60"
                    : "border-slate-200/70 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800/50"
                )}
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-[#007bb9] dark:text-sky-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="truncate">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {stay.roomName}
                      </span>
                      {stay.clientName && (
                        <>
                          <span className="text-slate-300 mx-1.5">·</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {stay.clientName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium flex items-center gap-1.5 pl-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Entrada {hhmm(normalizeDate(stay.checkInAt))} · Saída {hhmm(realtime.expectedCheckOut)}</span>
                  </div>
                  <div>
                    <DashboardStayLiveBadge expectedCheckOut={realtime.expectedCheckOut} graceMinutes={10} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Valor
                  </span>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    {formatCurrency(pricing.totalAmountDue)}
                  </div>
                  {pricing.consumptionsAmountDue > 0 && (
                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1 mt-0.5">
                      <Wine className="h-3 w-3" />
                      +{formatCurrency(pricing.consumptionsAmountDue)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Caixa e Visão dos Últimos 7 dias (Administradores) */}
      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          {/* Hoje no Caixa */}
          <section className="flex flex-col gap-3" data-tour="hotel-today">
            <SectionTitle subtitle="Total arrecadado hoje no fecho de turno">
              Hoje no Caixa
            </SectionTitle>
            <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#191E25] p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    {formatCurrency(today.total)}
                  </div>
                  <div className="text-xs text-slate-400 font-semibold mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {today.tickets === 0
                      ? "Nenhum movimento registado hoje"
                      : plural(today.tickets, "movimento registado", "movimentos registados")}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-orange-400/20">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      QUARTOS & ESTADIAS
                    </span>
                  </div>
                  <div className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    {formatCurrency(today.roomsTotal)}
                  </div>
                </div>
                <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      LOUNGE / BAR
                    </span>
                  </div>
                  <div className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    {formatCurrency(today.barTotal)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Últimos 7 dias */}
          <section className="flex flex-col gap-3" data-tour="hotel-week">
            <SectionTitle subtitle="Evolução de receitas ao longo da semana">
              Últimos 7 Dias
            </SectionTitle>
            <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#191E25] p-6 shadow-sm flex flex-col justify-between">
              <div className="h-[148px] flex items-end justify-between gap-3 pt-4 pb-1">
                {week.map((b) => {
                  const isPeak = b.total > 0 && b.total === weekMax;
                  const heightPercent = b.total > 0 ? Math.max(12, (b.total / weekMax) * 100) : 0;
                  return (
                    <div key={b.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                      {b.total > 0 && (
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-2xs whitespace-nowrap",
                            isPeak
                              ? "text-[#006194] dark:text-sky-300 bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800"
                              : "text-slate-400 bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800"
                          )}
                        >
                          {compact(b.total)}
                        </span>
                      )}
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={cn(
                            "w-full rounded-xl transition-all duration-300",
                            isPeak
                              ? "bg-gradient-to-t from-[#006194] via-[#007bb9] to-sky-400 shadow-md shadow-blue-500/20"
                              : b.total > 0
                              ? "bg-gradient-to-t from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 group-hover:from-blue-200 group-hover:to-blue-300"
                              : "bg-slate-100 dark:bg-slate-900 group-hover:bg-slate-200 dark:group-hover:bg-slate-800"
                          )}
                          style={{ height: `${heightPercent || 10}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-tight mt-1",
                          isPeak
                            ? "font-black text-[#006194] dark:text-sky-400"
                            : "font-bold text-slate-400 dark:text-slate-500"
                        )}
                      >
                        {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
