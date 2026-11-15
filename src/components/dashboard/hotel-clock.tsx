"use client";

import { useEffect, useState } from "react";
import { Clock, Thermometer } from "lucide-react";
import { formatHotelDate, formatHotelTime, nowDate } from "@/lib/server-time";

/** Hora certa (do servidor, fuso do hotel) e temperatura. A temperatura é opcional: se falhar, mostra só a hora. */
export function HotelClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [temp, setTemp] = useState<number | null>(null);

  useEffect(() => {
    setNow(nowDate());
    const t = setInterval(() => setNow(nowDate()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/weather", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (alive && typeof j.temp === "number") setTemp(Math.round(j.temp));
      } catch { /* sem temperatura */ }
    };
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!now) return null;
  return (
    <div className="flex items-center gap-3 text-xs font-semibold">
      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /><span className="text-base font-black tabular-nums">{formatHotelTime(now)}</span><span className="hidden sm:inline opacity-70">{formatHotelDate(now)}</span></span>
      {temp !== null && <span className="flex items-center gap-1"><Thermometer className="h-3.5 w-3.5" />{temp}°C</span>}
    </div>
  );
}
