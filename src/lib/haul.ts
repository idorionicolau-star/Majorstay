// "Barra puxada": enquanto uma confirmação demora (registar uma venda, uma transferência…), aparece ao centro um
// cartão com um objecto ligado à função a puxar uma barra de progresso. Quem chama só embrulha o trabalho em `haul`.

export type HaulKind = "sale" | "transfer" | "production" | "stock" | "document" | "report" | "settings" | "auth";
export type HaulPhase = "run" | "done" | "error";
export type HaulState = { id: number; kind: HaulKind; label: string; doneLabel: string; phase: HaulPhase } | null;

/** abaixo disto não aparece nada (não pisca nas confirmações rápidas) */
const SHOW_AFTER_MS = 400;
/** quanto tempo se vê o fim (barra cheia e ✓) ou o erro antes de fechar */
const DONE_MS = 900;
const ERROR_MS = 1200;

let state: HaulState = null;
let seq = 0;
const listeners = new Set<() => void>();
const set = (s: HaulState) => { state = s; listeners.forEach((l) => l()); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const subscribeHaul = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getHaul = () => state;

/**
 * Corre `work` e, se demorar mais de 0,4 s, mostra o cartão com a barra puxada. No fim enche a barra e mostra o ✓
 * (ou o erro) antes de devolver o resultado ou relançar o erro, para quem chama continuar como antes.
 */
export async function haul<T>(kind: HaulKind, label: string, doneLabel: string, work: () => Promise<T>): Promise<T> {
    const id = ++seq;
    let shown = false;
    const timer = setTimeout(() => { shown = true; set({ id, kind, label, doneLabel, phase: "run" }); }, SHOW_AFTER_MS);
    try {
        const result = await work();
        clearTimeout(timer);
        if (shown) { set({ id, kind, label, doneLabel, phase: "done" }); await wait(DONE_MS); if (state?.id === id) set(null); }
        return result;
    } catch (e) {
        clearTimeout(timer);
        if (shown) { set({ id, kind, label, doneLabel, phase: "error" }); await wait(ERROR_MS); if (state?.id === id) set(null); }
        throw e;
    }
}
