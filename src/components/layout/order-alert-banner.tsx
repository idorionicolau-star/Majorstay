"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { authedFetch } from "@/lib/api-client";
import { attentionCount, type AlertOrder } from "@/lib/order-alert";
import { audioReady, playOrderAlert, unlockAudio } from "@/lib/beep";

type Order = AlertOrder & { roomName?: string };

const POLL_MS = 15_000;
const REPEAT_MS = 30_000;
const MUTE_KEY = "majorstay.orderSound";

/**
 * Aviso de pedidos dos quartos em QUALQUER página: faixa no topo + 3 bips.
 * O som repete de 30 em 30 s enquanto houver pedido por aceitar ou entrega atrasada.
 */
export function OrderAlertBanner() {
  const ctx = useContext(InventoryContext);
  const pathname = usePathname();
  const companyId = ctx?.companyId;
  const enabled = !!companyId && !ctx?.isGuest && !!ctx?.canView?.("rooms");

  const [orders, setOrders] = useState<Order[]>([]);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const lastBeep = useRef(0);

  // som desligado neste aparelho?
  useEffect(() => {
    try { setMuted(localStorage.getItem(MUTE_KEY) === "0"); } catch { /* ignora */ }
  }, []);

  // o navegador só deixa tocar som depois do primeiro toque na página
  useEffect(() => {
    if (!enabled) return;
    const arm = async () => { if (await unlockAudio()) setReady(true); };
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => { window.removeEventListener("pointerdown", arm); window.removeEventListener("keydown", arm); };
  }, [enabled]);

  const load = useCallback(async () => {
    if (!enabled || !companyId) return;
    try {
      const { getAuth } = await import("firebase/auth");
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(`/api/room-orders?companyId=${encodeURIComponent(companyId)}&status=active`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setOrders(Array.isArray(json.orders) ? json.orders : []);
    } catch { /* sem ligação: tenta no próximo ciclo */ }
  }, [enabled, companyId]);

  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [enabled, load]);

  const counts = attentionCount(orders);
  const needs = counts.pending + counts.late > 0;

  // Aviso sonoro por voz: logo que chega um pedido novo, e a repetir de 30 em 30 s enquanto houver algo por atender
  useEffect(() => {
    const newPending = orders.some((o) => o.status === "pending" && !seen.current.has(o.id));
    orders.forEach((o) => seen.current.add(o.id));
    const wasFirst = firstLoad.current;
    firstLoad.current = false;
    if (muted || !needs) return;
    const now = Date.now();
    if ((newPending && !wasFirst) || now - lastBeep.current >= REPEAT_MS) {
      if (playOrderAlert()) lastBeep.current = now;
    }
  }, [orders, muted, needs]);

  // enquanto há algo por atender, a repetição também corre entre consultas
  useEffect(() => {
    if (!needs || muted) return;
    const t = setInterval(() => {
      if (Date.now() - lastBeep.current >= REPEAT_MS && playOrderAlert()) lastBeep.current = Date.now();
    }, 5_000);
    return () => clearInterval(t);
  }, [needs, muted]);

  if (!enabled) return null;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(MUTE_KEY, next ? "0" : "1"); } catch { /* ignora */ }
    if (!next) unlockAudio().then(setReady);
  };

  const onRooms = pathname.startsWith("/rooms");
  if (!needs) return null;

  const names = orders.filter((o) => o.status === "pending").map((o) => o.roomName).filter(Boolean);
  const text = counts.pending > 0
    ? counts.pending === 1 ? `Pedido novo${names[0] ? ` — ${names[0]}` : ""}` : `${counts.pending} pedidos novos por aceitar`
    : counts.late === 1 ? "Há 1 pedido atrasado na entrega" : `Há ${counts.late} pedidos atrasados na entrega`;

  return (
    <div role="alert" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md">
      <span className="flex items-center gap-2"><BellRing className="h-4 w-4 animate-pulse" />{text}</span>
      {!onRooms && (
        <Link href="/rooms" className="rounded-md bg-white px-3 py-1 text-xs font-bold text-rose-700 shadow-sm">Ver pedidos</Link>
      )}
      {!muted && !ready && !audioReady() && (
        <button type="button" onClick={() => unlockAudio().then(setReady)} className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-xs font-bold">
          <Volume2 className="h-3.5 w-3.5" /> Ativar som
        </button>
      )}
      <button type="button" onClick={toggleMute} className="flex items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold" aria-label={muted ? "Ligar som" : "Silenciar"}>
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        {muted ? "Som desligado" : "Silenciar"}
      </button>
    </div>
  );
}
