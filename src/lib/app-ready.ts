// Sinal de "a app está pronta" (sessão verificada e dados carregados). A animação de entrada espera por ele.
export const APP_READY_EVENT = "msx-app-ready";

type ReadyWindow = Window & { __msxReady?: boolean };

export function markAppReady() {
    if (typeof window === "undefined") return;
    const w = window as ReadyWindow;
    if (w.__msxReady) return;
    w.__msxReady = true;
    window.dispatchEvent(new Event(APP_READY_EVENT));
}

export const isAppReady = () => typeof window !== "undefined" && !!(window as ReadyWindow).__msxReady;
