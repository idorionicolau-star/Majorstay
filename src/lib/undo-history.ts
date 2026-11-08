// Histórico de desfazer/refazer, puro (sem React) para poder ser testado.
// Alterações seguidas ao MESMO campo em pouco tempo (escrever uma palavra) contam como uma só.

export type History<T> = { past: T[]; present: T; future: T[]; lastKey?: string; lastAt?: number };

const LIMIT = 100;
const COALESCE_MS = 900;

export const initHistory = <T>(value: T): History<T> => ({ past: [], present: value, future: [] });

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function pushHistory<T>(h: History<T>, next: T, opts: { key?: string; now?: number } = {}): History<T> {
    if (same(h.present, next)) return h;
    const now = opts.now ?? Date.now();
    const coalesce = !!opts.key && opts.key === h.lastKey && h.lastAt !== undefined && now - h.lastAt < COALESCE_MS && h.past.length > 0;
    return {
        past: coalesce ? h.past : [...h.past, h.present].slice(-LIMIT),
        present: next,
        future: [],
        lastKey: opts.key,
        lastAt: now,
    };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;

export function undoHistory<T>(h: History<T>): History<T> {
    if (!h.past.length) return h;
    const past = h.past.slice(0, -1);
    return { past, present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastKey: undefined, lastAt: undefined };
}

export function redoHistory<T>(h: History<T>): History<T> {
    if (!h.future.length) return h;
    const [next, ...future] = h.future;
    return { past: [...h.past, h.present], present: next, future, lastKey: undefined, lastAt: undefined };
}
