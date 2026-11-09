"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BedDouble, Lock, Sparkles } from "lucide-react";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "danger";
}) {
  return (
    <Link
      href="/rooms"
      className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold", tone === "danger" && value > 0 ? "text-red-600" : "text-foreground")}>
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
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
        <Lock strokeWidth={1.5} className="h-6 w-6 text-muted-foreground" />
        <p className="max-w-md text-sm text-muted-foreground">
          Não tem acesso aos quartos. Peça ao Dono ou ao Administrador para ativar essa permissão.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <BedDouble strokeWidth={1.5} className="h-10 w-10 text-primary" />
        <div>
          <p className="text-lg font-bold text-foreground">Ainda não tem quartos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie os quartos e as tarifas por hora para começar a registar estadias.
          </p>
        </div>
        <Link
          href="/rooms"
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Ir para os Quartos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Quartos agora */}
      <section className="flex flex-col gap-2" data-tour="hotel-rooms">
        <SectionTitle>Quartos agora</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Livres" value={stats.free} />
          <Tile label="Ocupados" value={stats.occupied} />
          <Tile label="Tempo excedido" value={stats.overtime} tone="danger" />
          <Tile label="Por limpar" value={stats.cleaning} />
        </div>
      </section>

      {/* 2. Alertas */}
      {(stats.overtime > 0 || stats.cleaning > 0) && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Alertas</SectionTitle>
          {stats.overtime > 0 && (
            <Link
              href="/rooms"
              className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {plural(stats.overtime, "quarto com tempo excedido", "quartos com tempo excedido")}
            </Link>
          )}
          {stats.cleaning > 0 && (
            <Link
              href="/rooms"
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm font-medium text-foreground"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
              {plural(stats.cleaning, "quarto por limpar", "quartos por limpar")}
            </Link>
          )}
        </section>
      )}

      {/* 3. Estadias abertas */}
      <section className="flex flex-col gap-2" data-tour="hotel-stays">
        <div className="flex items-baseline justify-between gap-3">
          <SectionTitle>Estadias abertas</SectionTitle>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">
              A receber agora: <b className="text-foreground">{formatCurrency(toReceive)}</b>
            </span>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Não há estadias abertas neste momento.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(({ stay, realtime, pricing }) => (
              <Link
                key={stay.id}
                href="/rooms"
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50",
                  realtime.isOvertime ? "border-red-300 dark:border-red-900" : "border-border"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {stay.roomName}
                    {stay.clientName ? ` · ${stay.clientName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Entrada {hhmm(normalizeDate(stay.checkInAt))} · Saída prevista {hhmm(realtime.expectedCheckOut)}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      realtime.isOvertime ? "text-red-600" : "text-muted-foreground"
                    )}
                  >
                    {formatTimeRemaining(realtime.minutesRemainingOrOverdue)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-foreground">{formatCurrency(pricing.totalAmountDue)}</p>
                  {pricing.consumptionsAmountDue > 0 && (
                    <p className="text-xs text-muted-foreground">
                      com bar {formatCurrency(pricing.consumptionsAmountDue)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Hoje e últimos 7 dias: só o Dono e o Administrador */}
      {isManager && (
        <>
          <section className="flex flex-col gap-2" data-tour="hotel-today">
            <SectionTitle>Hoje no caixa</SectionTitle>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-3xl font-bold text-foreground">{formatCurrency(today.total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {today.tickets === 0 ? "Ainda nenhum movimento hoje" : plural(today.tickets, "movimento", "movimentos")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Quartos (horas e consumos do quarto)</p>
                  <p className="font-bold text-foreground">{formatCurrency(today.roomsTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lounge (vendas do bar)</p>
                  <p className="font-bold text-foreground">{formatCurrency(today.barTotal)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2" data-tour="hotel-week">
            <SectionTitle>Últimos 7 dias</SectionTitle>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex h-36 items-end gap-2">
                {week.map((b) => (
                  <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="h-3 truncate text-[10px] leading-3 text-muted-foreground">
                      {b.total > 0 ? compact(b.total) : ""}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary"
                        style={{ height: `${b.total > 0 ? Math.max(4, (b.total / weekMax) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] uppercase text-muted-foreground">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
