// Rascunho de um formulário: o que a pessoa escreveu fica guardado no aparelho e volta quando ela reabre a janela
// (fechou sem querer, trocou de app para ler um código, o telemóvel fechou a página...). Puro: recebe o "storage".

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** Uma foto em base64 pode ter megabytes e rebentaria o limite do armazenamento: não vai para o rascunho. */
const MAX_VALUE_CHARS = 100_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Saved<T> = { values: T; savedAt: number };

const defaultStore = (): Store | null => {
    try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
};

export function readDraft<T>(key: string, now = Date.now(), store: Store | null = defaultStore()): T | null {
    if (!store) return null;
    try {
        const raw = store.getItem(key);
        if (!raw) return null;
        const saved = JSON.parse(raw) as Saved<T>;
        if (!saved || typeof saved.savedAt !== "number" || now - saved.savedAt > DRAFT_TTL_MS) { store.removeItem(key); return null; }
        return saved.values;
    } catch {
        return null;
    }
}

/** Valores muito grandes (fotos) ficam de fora; se mesmo assim não couber, desiste em silêncio. */
export function writeDraft<T extends Record<string, unknown>>(key: string, values: T, now = Date.now(), store: Store | null = defaultStore()): void {
    if (!store) return;
    const slim = Object.fromEntries(Object.entries(values).filter(([, v]) => !(typeof v === "string" && v.length > MAX_VALUE_CHARS))) as T;
    try { store.setItem(key, JSON.stringify({ values: slim, savedAt: now } satisfies Saved<T>)); } catch { /* sem espaço / modo privado: o rascunho é só um extra */ }
}

export function clearDraft(key: string, store: Store | null = defaultStore()): void {
    try { store?.removeItem(key); } catch { /* ignore */ }
}

/** Há alguma coisa escrita no "Novo produto" que valha a pena guardar? */
export function catalogDraftHasContent(v: { name?: unknown; barcode?: unknown; price?: unknown; cost?: unknown; stock?: unknown; imageUrl?: unknown } | undefined): boolean {
    if (!v) return false;
    const text = (x: unknown) => String(x ?? "").trim().length > 0;
    const num = (x: unknown) => Number(String(x ?? "").replace(",", ".")) > 0;
    return text(v.name) || text(v.barcode) || num(v.price) || num(v.cost) || num(v.stock) || text(v.imageUrl);
}
