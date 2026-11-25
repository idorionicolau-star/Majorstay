"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
    CLIENT_BUILD, MAX_AUTO_RELOADS, canAutoReload, isStale, nextReloadState, safeToReload, type ReloadState,
} from "@/lib/app-version";

const KEY = "msx-version-reload";
const CHECK_EVERY_MS = 3 * 60 * 1000;
const MIN_GAP_MS = 20 * 1000;

const readState = (): ReloadState | null => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; }
};
const writeState = (s: ReloadState) => {
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
};

/**
 * Se o servidor já está numa versão mais nova, este ecrã está desatualizado (preços, regras e correções antigas).
 * Recarrega sozinho quando é seguro (sem janelas abertas nem ninguém a escrever) e, enquanto não o fizer, mostra o aviso.
 */
export function VersionWatcher() {
    const [target, setTarget] = useState<string | null>(null);
    const [manual, setManual] = useState(false);
    const lastCheck = useRef(0);

    const check = useCallback(async () => {
        if (CLIENT_BUILD === "dev" || !navigator.onLine) return;
        const now = Date.now();
        if (now - lastCheck.current < MIN_GAP_MS) return;
        lastCheck.current = now;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            const res = await fetch(`/api/version?t=${now}`, { cache: "no-store", signal: ctrl.signal }).finally(() => clearTimeout(timer));
            const json = await res.json().catch(() => ({}));
            setTarget(isStale(CLIENT_BUILD, json?.build) ? String(json.build) : null);
        } catch { /* sem rede ou erro: tenta mais tarde */ }
    }, []);

    useEffect(() => {
        check();
        const id = setInterval(check, CHECK_EVERY_MS);
        const onVisible = () => { if (document.visibilityState === "visible") check(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", check);
        return () => {
            clearInterval(id);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", check);
        };
    }, [check]);

    // Com versão nova à espera: recarrega assim que for seguro (e só algumas vezes, para nunca ficar em ciclo)
    useEffect(() => {
        if (!target) return;
        const tryReload = () => {
            const now = Date.now();
            const state = readState();
            if (state && state.target === target && state.count >= MAX_AUTO_RELOADS) { setManual(true); return; }
            if (!navigator.onLine || !safeToReload(document) || !canAutoReload(state, target, now)) return;
            writeState(nextReloadState(state, target, now));
            window.location.reload();
        };
        tryReload();
        const id = setInterval(tryReload, 5000);
        return () => clearInterval(id);
    }, [target]);

    if (!target) return null;
    return (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <RefreshCw className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1">
                <b>Há uma versão nova da app.</b>{" "}
                {manual ? "Atualize agora para ter os preços e correções certos." : "Vai atualizar sozinha quando terminar o que está a fazer."}
            </p>
            <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-lg border border-amber-500/40 px-3 py-1 text-xs font-semibold">
                Atualizar agora
            </button>
        </div>
    );
}
