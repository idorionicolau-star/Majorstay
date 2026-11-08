// Vendas pela EscalePay (plataforma de afiliados, sem webhook): lógica pura, sem Firebase, para ser testada.
//
// A pessoa compra na EscalePay e regista a empresa pelo link /register?origem=escalepay com o MESMO email da compra.
// Enquanto a compra não é confirmada, usa o teste gratuito. A compra confirma-se de duas formas:
//  - automática: o email de "nova venda" da EscalePay é lido por um script no Gmail, que avisa a app;
//  - manual, de uma vez: o administrador cola a lista de compradores (ou o texto dos emails) no painel.
// Cada venda dá N meses à empresa cujo administrador tem esse email (agora, ou quando se registar).

export const ESCALEPAY_SOURCE = 'escalepay';
export const ESCALEPAY_REGISTER_PATH = '/register?origem=escalepay';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export const normEmail = (e: string) => String(e || '').trim().toLowerCase();

export const isEmail = (e: string) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normEmail(e));

/**
 * Os emails que aparecem num texto colado (lista do painel da EscalePay, emails de venda…), sem repetidos.
 * `ignore`: emails a deixar de fora (o do próprio administrador, por exemplo); os da EscalePay saem sempre.
 */
export function extractEmails(text: string, ignore: string[] = []): string[] {
    const skip = new Set(ignore.map(normEmail));
    const out: string[] = [];
    for (const m of String(text || '').match(EMAIL_RE) || []) {
        const e = normEmail(m).replace(/\.+$/, '');
        if (!isEmail(e) || skip.has(e) || /escalepay/i.test(e.split('@')[1] || '') || out.includes(e)) continue;
        out.push(e);
    }
    return out;
}

/** Meses válidos por venda: inteiro de 1 a 12 (por defeito 1). */
export function saleMonths(m: unknown): number {
    const n = Math.round(Number(m));
    return Number.isFinite(n) && n >= 1 ? Math.min(12, n) : 1;
}

/**
 * Identificador da venda (evita contar a mesma venda duas vezes):
 * com a referência da compra (n.º do pedido, id do email), essa; sem ela, o email + o dia
 * (colar a mesma lista duas vezes no mesmo dia não dá meses a dobrar).
 */
export function saleIdFor(email: string, ref: string | undefined | null, now: Date): string {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9@._-]+/g, '-').slice(0, 140);
    if (ref && ref.trim()) return `ref-${clean(ref.trim())}`;
    return `m-${clean(normEmail(email))}-${now.toISOString().slice(0, 10)}`;
}

function addMonths(from: Date, months: number) {
    const d = new Date(from.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
}

/** O novo período começa no mais tardio entre agora e o fim actual (comprar antes do fim não perde dias). */
export function extendFrom(now: Date, currentEnd: string | null | undefined, months: number): { start: Date; end: Date } {
    const cur = currentEnd ? new Date(currentEnd) : null;
    const start = cur && !isNaN(cur.getTime()) && cur > now ? cur : now;
    return { start, end: addMonths(start, months) };
}

/** O plano equivalente (para mostrar), quando os meses batem com um plano. */
export function planForMonths(months: number): string | undefined {
    return months === 1 ? 'mensal' : months === 3 ? 'trimestral' : months === 12 ? 'anual' : undefined;
}
