// Proteções do envio de emails pela app (/api/email): o conteúdo vindo do navegador é texto, nunca HTML, e só se envia
// para endereços que são da própria empresa (ou, num recibo, para um cliente dela). Puro, para ser testado.

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Texto seguro para pôr dentro de HTML. */
export const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Escapa todos os textos de um objeto (e de listas de objetos), para os modelos de email usarem sem risco. */
export function escapeAll<T>(v: T): T {
    if (typeof v === 'string') return escapeHtml(v) as unknown as T;
    if (Array.isArray(v)) return v.map(escapeAll) as unknown as T;
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, escapeAll(x)])) as T;
    return v;
}

/** Só um endereço https é aceite como logótipo (nada de javascript:, data:, etc.). */
export const safeImageUrl = (u: unknown) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '');

/** Assunto numa só linha e curto. */
export const cleanSubject = (s: unknown, fallback: string) => {
    const t = String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
    return t || fallback;
};

export const normEmail = (e: string) => e.trim().toLowerCase();

/** Lista de destinatários pedida (texto com vírgulas ou lista), sem repetições. */
export function parseRecipients(to: unknown): string[] {
    const raw = Array.isArray(to) ? to.flatMap((e) => (typeof e === 'string' ? e.split(',') : [])) : typeof to === 'string' ? to.split(',') : [];
    return [...new Set(raw.map(normEmail).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
}

/** Os destinatários que não estão autorizados (vazio = pode enviar). */
export const notAllowed = (recipients: string[], allowed: Iterable<string>) => {
    const ok = new Set([...allowed].map(normEmail));
    return recipients.filter((r) => !ok.has(r));
};

/** Máximo de emails por empresa por dia. */
export const EMAIL_DAILY_LIMIT = 300;
