"use client";

import { useContext, useEffect } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { setHotelTimeZone, syncServerTime } from "@/lib/server-time";

/** Mantém o relógio da app certo (hora do servidor) e o fuso horário do hotel. */
export function ServerTimeSync() {
  const ctx = useContext(InventoryContext);
  const tz = (ctx?.companyData as { timeZone?: string } | null | undefined)?.timeZone;

  useEffect(() => { setHotelTimeZone(tz); }, [tz]);

  useEffect(() => {
    syncServerTime();
    const t = setInterval(syncServerTime, 10 * 60_000);
    const onVis = () => { if (document.visibilityState === "visible") syncServerTime(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onVis); };
  }, []);

  return null;
}
