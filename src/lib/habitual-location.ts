// A localização "habitual": a que a pessoa mais usa neste aparelho (não a última). Cada vez que grava algo numa
// localização conta um uso; ao abrir um ecrã, abre-se na mais usada (empate: a mais recente). À primeira vez
// é a única escolhida; a partir da segunda escolha já manda a que mais se repete.
type Use = { n: number; at: number };
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'majorstockx-location-use';
const store = (): Store | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

function read(s: Store | null): Record<string, Use> {
    try { return s ? JSON.parse(s.getItem(KEY) || '{}') : {}; } catch { return {}; }
}

export function recordLocation(id: string, now = Date.now(), s: Store | null = store()): void {
    if (!id || !s) return;
    const all = read(s);
    all[id] = { n: (all[id]?.n || 0) + 1, at: now };
    try { s.setItem(KEY, JSON.stringify(all)); } catch { /* sem armazenamento */ }
}

/** A mais usada entre as localizações que existem (ou null se ainda não escolheu nenhuma). */
export function habitualLocation(validIds: string[], s: Store | null = store()): string | null {
    const all = read(s);
    const ranked = validIds.filter((id) => all[id]).sort((a, b) => all[b].n - all[a].n || all[b].at - all[a].at);
    return ranked[0] ?? null;
}
