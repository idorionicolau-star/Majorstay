"use client";

// Estado global do guia activo (qual e em que passo). Não precisa de contexto React: qualquer botão pode
// começar um guia com `startGuide("catalogo")`. Fica no sessionStorage para sobreviver a um recarregar.
import { useSyncExternalStore } from "react";
import { rememberSeen } from "@/lib/seen-store";

export type GuideState = { id: string; index: number } | null;

const KEY = "majorstockx-guide";
let state: GuideState = null;
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
        const raw = sessionStorage.getItem(KEY);
        state = raw ? (JSON.parse(raw) as GuideState) : null;
    } catch {
        state = null;
    }
}

function emit() {
    try {
        if (state) sessionStorage.setItem(KEY, JSON.stringify(state));
        else sessionStorage.removeItem(KEY);
    } catch {
        /* sem armazenamento: o guia funciona na mesma, só não sobrevive a um recarregar */
    }
    listeners.forEach((l) => l());
}

export const guideStore = {
    get(): GuideState {
        ensureLoaded();
        return state;
    },
    subscribe(l: () => void) {
        listeners.add(l);
        return () => {
            listeners.delete(l);
        };
    },
    start(id: string, index = 0) {
        ensureLoaded();
        state = { id, index };
        emit();
    },
    go(index: number) {
        ensureLoaded();
        if (!state) return;
        state = { ...state, index };
        emit();
    },
    stop() {
        ensureLoaded();
        state = null;
        emit();
    },
};

export const startGuide = (id: string) => guideStore.start(id);
export const stopGuide = () => guideStore.stop();

export function useGuideState(): GuideState {
    return useSyncExternalStore(guideStore.subscribe, guideStore.get, () => null);
}

// ---- guias já feitos (por aparelho) ----
const doneKey = (id: string) => `majorstockx-guide-done-${id}`;

export function isGuideDone(id: string): boolean {
    try {
        return localStorage.getItem(doneKey(id)) === "1";
    } catch {
        return false;
    }
}

export function markGuideDone(id: string) {
    try {
        localStorage.setItem(doneKey(id), "1");
    } catch {
        /* ignore */
    }
    rememberSeen(doneKey(id));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("msx:guide-done"));
}
