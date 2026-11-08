// Afiliados — lógica pura (sem Firebase), para ser testada. Quem cria os afiliados é o super-administrador
// (painel de Administração); cada um recebe um código e um link de registo. As empresas que entram com o código
// ficam ligadas ao afiliado, que ganha uma percentagem do que elas pagam durante um período a contar do 1.º pagamento.

export const APP_URL = "https://stock.majorgroup.app";
export const DEFAULT_COMMISSION_PCT = 40;
export const DEFAULT_COMMISSION_MONTHS = 12;

export type Affiliate = {
    code: string;
    name: string;
    phone: string;
    /** % do que o cliente paga */
    commissionPct: number;
    /** durante quantos meses, a contar do 1.º pagamento do cliente */
    commissionMonths: number;
    /** desconto para o cliente (preço/mês no plano Mensal) — null = sem desconto */
    clientPrice: number | null;
    clientMonths: number | null;
    active: boolean;
    createdAt: string;
};

/** O que fica gravado na empresa que entrou pelo código. */
export type CompanyAffiliate = { code: string; name: string; linkedAt: string };

export const affiliateLink = (code: string) => `${APP_URL}/register?codigo=${encodeURIComponent(code)}`;

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Maria José" → "MARIA" + 2 algarismos, sem repetir nenhum código existente. */
export function suggestCode(name: string, taken: Set<string>, rand: () => number = Math.random): string {
    const base = (strip(name).toUpperCase().match(/[A-Z]+/g) || ["AFIL"])[0].slice(0, 6).padEnd(3, "X");
    for (let i = 0; i < 200; i++) {
        const code = base + String(10 + Math.floor(rand() * 90));
        if (!taken.has(code)) return code;
    }
    return base + String(Date.now()).slice(-4);
}

export type AffiliateInput = {
    name: string; phone: string; code?: string;
    clientPrice?: string | number | null; clientMonths?: string | number | null;
    commissionPct?: string | number | null; commissionMonths?: string | number | null;
};

const num = (v: unknown) => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
};

/** Validar um afiliado novo. `taken` = códigos já usados (afiliados e códigos de desconto). `basePrice` = Mensal. */
export function checkAffiliate(i: AffiliateInput, taken: Set<string>, basePrice: number):
    { ok: true; value: Omit<Affiliate, "active" | "createdAt"> } | { ok: false; error: string } {
    const name = String(i.name || "").trim().replace(/\s+/g, " ");
    if (name.length < 2) return { ok: false, error: "Escreva o nome do afiliado." };
    const phone = String(i.phone || "").replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length < 9) return { ok: false, error: "Escreva o número de telefone (9 algarismos)." };
    const code = String(i.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return { ok: false, error: "O código tem de ter 4 a 12 letras ou números, sem espaços." };
    if (taken.has(code)) return { ok: false, error: `O código ${code} já existe.` };
    const pct = num(i.commissionPct) ?? DEFAULT_COMMISSION_PCT;
    if (!(pct > 0 && pct <= 100)) return { ok: false, error: "A comissão tem de ser entre 1% e 100%." };
    const months = num(i.commissionMonths) ?? DEFAULT_COMMISSION_MONTHS;
    if (!(Number.isInteger(months) && months >= 1 && months <= 120)) return { ok: false, error: "A duração da comissão tem de ser entre 1 e 120 meses." };
    const price = num(i.clientPrice);
    if (price !== null && !(price > 0 && price < basePrice)) return { ok: false, error: `O preço com desconto tem de ser maior que 0 e menor que ${basePrice} MT.` };
    const cMonths = price === null ? null : (num(i.clientMonths) ?? 3);
    if (cMonths !== null && !(Number.isInteger(cMonths) && cMonths >= 1 && cMonths <= 24)) return { ok: false, error: "Os meses com desconto têm de ser entre 1 e 24." };
    return { ok: true, value: { code, name, phone, commissionPct: pct, commissionMonths: months, clientPrice: price, clientMonths: cMonths } };
}

export type PaidPayment = { amount: number; paidAt?: string; status?: string };

const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
/** Mês de calendário em Maputo (UTC+2), "AAAA-MM". */
const monthMz = (d: Date) => new Date(d.getTime() + 2 * 3600_000).toISOString().slice(0, 7);

/**
 * Comissão de um cliente do afiliado: `pct`% de cada pagamento feito nos `months` meses a seguir ao 1.º pagamento
 * (o teste grátis não conta; se o cliente deixar de pagar, deixa de haver comissão).
 */
export function clientCommission(payments: PaidPayment[], pct: number, months: number, now = new Date()) {
    const paid = payments
        .filter((p) => (p.status ?? "paid") === "paid" && p.paidAt && !isNaN(Date.parse(p.paidAt)) && Number(p.amount) > 0)
        .sort((a, b) => Date.parse(a.paidAt!) - Date.parse(b.paidAt!));
    if (!paid.length) return { firstPaidAt: null as string | null, endsAt: null as string | null, paidTotal: 0, commission: 0, thisMonth: 0 };
    const first = new Date(paid[0].paidAt!);
    const end = addMonths(first, months);
    const inWindow = paid.filter((p) => Date.parse(p.paidAt!) < end.getTime());
    const paidTotal = inWindow.reduce((t, p) => t + Number(p.amount), 0);
    const nowMonth = monthMz(now);
    const thisMonthPaid = inWindow.filter((p) => monthMz(new Date(p.paidAt!)) === nowMonth).reduce((t, p) => t + Number(p.amount), 0);
    const round = (n: number) => Math.round(n * 100) / 100;
    return { firstPaidAt: first.toISOString(), endsAt: end.toISOString(), paidTotal, commission: round(paidTotal * pct / 100), thisMonth: round(thisMonthPaid * pct / 100) };
}
