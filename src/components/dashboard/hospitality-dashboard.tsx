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
  formatTimeRemaining,
  normalizeDate,
} from "@/lib/hospitality-calc";
import { lastDays, summarizeDay } from "@/lib/hospitality-dashboard";
import { cn, formatCurrency } from "@/lib/utils";

const compact = (v: number) =>
  new Intl.NumberFormat("pt-MZ", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const hhmm = (d: Date) => d.toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit" });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
      badgeBg: "bg-[#EDF6F0] text-[#245D3B] dark:bg-[#1C3023] dark:text-[#8CD9A9]",
      textCol: "text-[#245D3B] dark:text-[#8CD9A9]",
      hoverBorder: "hover:border-[#488C64]/60",
    },
    occupied: {
      badgeBg: "bg-[#FAF0E6] text-[#BA5A1A] dark:bg-[#341F14] dark:text-[#F3B080]",
      textCol: "text-[#BA5A1A] dark:text-[#F3B080]",
      hoverBorder: "hover:border-[#BA5A1A]/60",
    },
    overtime: {
      badgeBg: "bg-[#FDF0EE] text-[#C53030] dark:bg-[#381616] dark:text-[#FEB2B2]",
      textCol: value > 0 ? "text-[#C53030] dark:text-[#FEB2B2]" : "text-stone-700 dark:text-stone-300",
      hoverBorder: "hover:border-[#C53030]/60",
    },
    cleaning: {
      badgeBg: "bg-[#FAF4E6] text-[#975A16] dark:bg-[#322510] dark:text-[#ECC94B]",
      textCol: "text-[#975A16] dark:text-[#ECC94B]",
      hoverBorder: "hover:border-[#DF9E42]/60",
    },
  }[tone];

  return (
    <Link
      href="/rooms"
      className={cn(
        "group rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        toneConfig.hoverBorder
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          {label}
        </p>
        <div className={cn("p-2 rounded-xl", toneConfig.badgeBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn("mt-2 text-3xl font-headline font-black", toneConfig.textCol)}>
        {value}
      </p>
    </Link>
  );
}

export function HospitalityDashboard() {
  const { openStays, stats, loading } = useRooms();
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
            contractedHours: stay.contractedHours,
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

  if (!canView("rooms")) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] p-8 text-center shadow-sm">
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
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#EFEBE4]/60 dark:bg-[#261D19] border border-[#E5DFD6]/60 dark:border-[#382D26]/60" />
          ))}
        </div>
        <div className="h-44 animate-pulse rounded-2xl bg-[#EFEBE4]/60 dark:bg-[#261D19] border border-[#E5DFD6]/60 dark:border-[#382D26]/60" />
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] p-10 text-center shadow-sm max-w-xl mx-auto my-8">
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
          className="rounded-xl bg-[#BA5A1A] hover:bg-[#9C4811] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all flex items-center gap-2"
        >
          Configurar Quartos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-2 sm:px-0">
      {/* 1. Quartos agora */}
      <section className="flex flex-col gap-3" data-tour="hotel-rooms">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle subtitle="Disponibilidade e ocupação em tempo real">
            Quartos & Ocupação Agora
          </SectionTitle>
          <Link
            href="/rooms/checkin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#BA5A1A] hover:bg-[#9C4811] text-white text-xs font-bold shadow-xs transition-all shrink-0"
          >
            <Key className="w-3.5 h-3.5" />
            Novo Check-in
          </Link>
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
                className="flex items-center gap-3 rounded-2xl border border-[#F6E0B5] dark:border-[#4E3917] bg-[#FFFBF0] dark:bg-[#2A2012] p-4 text-xs font-bold text-[#975A16] dark:text-[#ECC94B] shadow-sm hover:opacity-95 transition-all"
              >
                <div className="p-2 rounded-xl bg-[#DF9E42]/15 shrink-0">
                  <Sparkles className="h-5 w-5 text-[#DF9E42]" />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {plural(stats.cleaning, "quarto a aguardar limpeza", "quartos a aguardar limpeza")}
                  </p>
                  <p className="text-[11px] font-normal text-[#975A16]/80 mt-0.5">
                    Libertar para novos hóspedes após higienização.
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
            <div className="text-xs text-stone-500 dark:text-stone-400 bg-[#FFFDF9] dark:bg-[#201915] border border-[#E5DFD6] dark:border-[#382D26] px-3 py-1 rounded-full shadow-sm">
              A receber agora: <b className="text-stone-900 dark:text-stone-100 font-bold">{formatCurrency(toReceive)}</b>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] p-6 text-center text-xs text-stone-500 shadow-sm">
            Nenhum quarto com estadia ativa neste momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map(({ stay, realtime, pricing }) => (
              <Link
                key={stay.id}
                href="/rooms"
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border bg-[#FFFDF9] dark:bg-[#201915] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                  realtime.isOvertime
                    ? "border-[#FBD5D0] dark:border-[#5C2323]"
                    : "border-[#E5DFD6] dark:border-[#382D26] hover:border-[#BA5A1A]/40"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-headline font-bold text-sm text-stone-900 dark:text-stone-100">
                      {stay.roomName}
                    </p>
                    {stay.clientName && (
                      <span className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        · {stay.clientName}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-stone-400" />
                    Entrada {hhmm(normalizeDate(stay.checkInAt))} · Saída {hhmm(realtime.expectedCheckOut)}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-bold mt-1",
                      realtime.isOvertime ? "text-[#C53030] dark:text-[#FEB2B2]" : "text-[#BA5A1A] dark:text-[#E0852E]"
                    )}
                  >
                    {formatTimeRemaining(realtime.minutesRemainingOrOverdue)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-headline font-black text-base text-stone-900 dark:text-stone-100">
                    {formatCurrency(pricing.totalAmountDue)}
                  </p>
                  {pricing.consumptionsAmountDue > 0 && (
                    <p className="text-[10px] font-semibold text-[#DF9E42] flex items-center justify-end gap-1 mt-0.5">
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
            <div className="rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] p-5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-3xl font-headline font-black text-stone-900 dark:text-stone-100">
                    {formatCurrency(today.total)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {today.tickets === 0
                      ? "Nenhum encerramento ou venda registada hoje"
                      : plural(today.tickets, "movimento registado", "movimentos registados")}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#E5DFD6] dark:border-[#382D26] pt-4">
                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1714] border border-[#E5DFD6] dark:border-[#382D26]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Quartos & Estadias
                  </p>
                  <p className="text-lg font-headline font-black text-stone-900 dark:text-stone-100 mt-0.5">
                    {formatCurrency(today.roomsTotal)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1714] border border-[#E5DFD6] dark:border-[#382D26]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Lounge / Bar
                  </p>
                  <p className="text-lg font-headline font-black text-stone-900 dark:text-stone-100 mt-0.5">
                    {formatCurrency(today.barTotal)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Últimos 7 dias */}
          <section className="flex flex-col gap-3" data-tour="hotel-week">
            <SectionTitle subtitle="Evolução de receitas ao longo da semana">
              Últimos 7 Dias
            </SectionTitle>
            <div className="rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex h-36 items-end gap-2 pt-2">
                {week.map((b) => (
                  <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="h-3 truncate text-[10px] font-bold text-stone-500">
                      {b.total > 0 ? compact(b.total) : ""}
                    </span>
                    <div className="flex w-full flex-1 items-end bg-[#FAF7F2] dark:bg-[#1A1411] rounded-t-lg overflow-hidden p-0.5">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[#BA5A1A] to-[#DF9E42] transition-all duration-300"
                        style={{ height: `${b.total > 0 ? Math.max(8, (b.total / weekMax) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-stone-500 tracking-wider">
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
