// O que o utilizador já viu (tutoriais feitos, convites fechados, boas-vindas, tour): no aparelho e na conta.
// Sem dependências de React/contexto, para poder ser usado em qualquer lado (ver seen-sync.tsx).

export const PREFIX = "majorstockx-";
/** chaves do localStorage que contam como "já visto" (sem o prefixo) */
const SYNCED = ["guide-done-", "hint-dismissed-", "welcome-seen-", "tour-seen-", "hints-off", "demo-sale-", "started-hidden-"];
export const isSynced = (name: string) => SYNCED.some((s) => name.startsWith(s));

let remote: ((name: string) => void) | null = null;
let ready = false;

/** A sincronização com a conta já correu? Os convites esperam por isto para não perguntar à toa. */
export const seenReady = () => ready;
export const setSeenReady = (v: boolean) => { ready = v; };
export const setSeenRemote = (fn: ((name: string) => void) | null) => { remote = fn; };

/** Chamado sempre que algo passa a "visto" no aparelho: guarda-o também na conta. */
export function rememberSeen(localKey: string) {
    const name = localKey.startsWith(PREFIX) ? localKey.slice(PREFIX.length) : localKey;
    if (isSynced(name)) remote?.(name);
}

export function localSeen(): string[] {
    const out: string[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(PREFIX)) continue;
            const name = k.slice(PREFIX.length);
            if (isSynced(name) && localStorage.getItem(k) === "1") out.push(name);
        }
    } catch { /* sem armazenamento */ }
    return out;
}
