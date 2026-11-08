"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { installMode, isIos, isIosSafari, type InstallMode } from "@/lib/install-app";

const DISMISS_KEY = "majorstockx-install-dismissed";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Convite para instalar a app no ecrã principal. Android/computador: botão "Instalar" (o navegador trata do resto).
 * iPhone (Safari): não há botão — mostra o guia "Partilhar → Adicionar ao ecrã principal". Dispensável (volta passados 14 dias).
 */
export function InstallPrompt() {
    const [mode, setMode] = useState<InstallMode>("none");
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return;
        const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
        let dismissedAt = 0;
        try { dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0); } catch { /* ignore */ }
        const ua = navigator.userAgent;
        const ios = isIos(ua, navigator.maxTouchPoints);
        const base = { standalone, ios, safari: isIosSafari(ua), dismissedAt, now: Date.now() };

        setMode(installMode({ ...base, canPrompt: false }));
        const onPrompt = (e: Event) => {
            e.preventDefault(); // guarda-o para o botão
            setDeferred(e as BeforeInstallPromptEvent);
            setMode(installMode({ ...base, canPrompt: true }));
        };
        const onInstalled = () => { setMode("none"); setDeferred(null); };
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const dismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
        setMode("none");
    };

    const install = async () => {
        if (!deferred) return;
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        if (outcome === "accepted") setMode("none"); else dismiss();
    };

    if (mode === "none") return null;
    return (
        <div role="region" aria-label="Instalar a app" className="mb-3 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
                <p className="font-semibold">Instale a MajorStockX no seu aparelho</p>
                {mode === "prompt" ? (
                    <p className="text-muted-foreground">Abre mais depressa, em ecrã inteiro, e funciona sem internet.</p>
                ) : (
                    <p className="text-muted-foreground">
                        Toque em <Share className="mx-0.5 inline h-3.5 w-3.5 align-text-bottom" /> <b>Partilhar</b> e depois em <b>Adicionar ao ecrã principal</b>.
                    </p>
                )}
                {mode === "prompt" && (
                    <Button size="sm" className="mt-2" onClick={install}>Instalar</Button>
                )}
            </div>
            <button type="button" onClick={dismiss} aria-label="Dispensar" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
