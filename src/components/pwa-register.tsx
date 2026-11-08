"use client";

import { useContext, useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { mainNavItems } from "@/lib/data";

const WARM_KEY = "majorstockx-sw-warm";
const WARM_EVERY_MS = 12 * 60 * 60 * 1000;

/**
 * Regista o service worker (modo offline + notificações) e, uma vez por dia, pede-lhe para
 * guardar as páginas principais. Só em produção: em desenvolvimento a cache atrapalha.
 */
export function PwaRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
        let cancelled = false;

        const start = async () => {
            try {
                const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
                await navigator.serviceWorker.ready;
                if (cancelled || !navigator.onLine) return;
                let last = 0;
                try { last = Number(localStorage.getItem(WARM_KEY) || 0); } catch { /* ignore */ }
                if (Date.now() - last < WARM_EVERY_MS) return;
                const urls = Array.from(new Set(["/dashboard", ...mainNavItems.flatMap((i) => [i.href, ...(i.also || [])])]));
                (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: "WARM", urls });
                try { localStorage.setItem(WARM_KEY, String(Date.now())); } catch { /* ignore */ }
            } catch (e) {
                console.warn("[PWA] service worker não registou:", e);
            }
        };

        // Espera a app carregar para não competir com o primeiro ecrã
        if (document.readyState === "complete") start();
        else window.addEventListener("load", start, { once: true });
        return () => { cancelled = true; };
    }, []);

    return null;
}

/**
 * "Há uma versão nova": o service worker novo assume o controlo sozinho, mas o ecrã aberto continua com o código antigo
 * até recarregar. Avisa e deixa o utilizador escolher o momento (recarregar a meio de uma venda perdia o que escrevia).
 */
export function UpdateNotice() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
        // Só conta como actualização se já havia um service worker a controlar: na 1.ª visita também há "controllerchange"
        const hadController = !!navigator.serviceWorker.controller;
        const onChange = () => { if (hadController) setReady(true); };
        navigator.serviceWorker.addEventListener("controllerchange", onChange);
        return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    }, []);
    if (!ready) return null;
    return (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
            <RefreshCw className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="min-w-0 flex-1"><b>Há uma versão nova.</b> Atualize quando terminar o que está a fazer.</p>
            <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-lg border border-emerald-500/40 px-3 py-1 text-xs font-semibold">
                Atualizar
            </button>
        </div>
    );
}

/** Faixa que avisa quando não há internet — e tranquiliza: o trabalho fica guardado e segue sozinho. */
export function OfflineBanner() {
    const [online, setOnline] = useState(true);
    const ctx = useContext(InventoryContext);
    const pending = ctx?.pendingOfflineSales || 0;

    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        update();
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);

    if (online && !pending) return null;
    return (
        <div role="status" className="mb-3 space-y-2">
            {!online && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="min-w-0 flex-1">
                        <b>Sem internet.</b> Pode continuar a vender, levantar material e fazer entradas e contagens no Stock Rápido: fica tudo guardado neste aparelho e segue sozinho quando a ligação voltar. As vendas recebem um recibo provisório (OFF-…) e o número oficial é atribuído ao sincronizar. Transferir, produzir e auditar ainda precisam de internet. Não limpe os dados do navegador até sincronizar.
                    </p>
                </div>
            )}
            {pending > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
                    <RefreshCw className="h-4 w-4 shrink-0 text-blue-600" />
                    <p className="min-w-0 flex-1">
                        <b>{pending} venda{pending > 1 ? "s" : ""} por numerar.</b> {online ? "A sincronizar…" : "Serão numeradas quando houver internet."}
                    </p>
                    {online && (
                        <button type="button" onClick={() => ctx?.syncOfflineSales()} className="shrink-0 rounded-lg border border-blue-500/40 px-3 py-1 text-xs font-semibold">
                            Sincronizar agora
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
