// Relatório do fim do dia (email): contas puras, sem Firebase, para serem testadas.

type ReportSale = { productName?: string; quantity?: number; totalValue?: number; unit?: string };
type ReportProduct = {
    name?: string; location?: string; stock?: number; reservedStock?: number;
    criticalStockThreshold?: number; unit?: string; deletedAt?: string;
};
type ReportLocation = { id: string; name: string };

export type TopProduct = { name: string; quantity: number; value: number; unit?: string };
export type CriticalProduct = { name: string; location: string; available: number; threshold: number; unit?: string };

/** "" e "Principal" são o mesmo local (ver lib/product-ref.ts). */
const normLoc = (l?: string) => (!l || l === 'Principal' ? '' : l);

/** Os `n` produtos mais vendidos (por quantidade; empate: maior valor). */
export function topProducts(sales: ReportSale[], n = 3): TopProduct[] {
    const by = new Map<string, TopProduct>();
    for (const s of sales) {
        const name = String(s.productName || '').trim();
        if (!name) continue;
        const cur = by.get(name) || { name, quantity: 0, value: 0, unit: s.unit };
        cur.quantity += Number(s.quantity) || 0;
        cur.value += Number(s.totalValue) || 0;
        by.set(name, cur);
    }
    return [...by.values()]
        .filter((p) => p.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity || b.value - a.value)
        .slice(0, n);
}

/**
 * Produtos em stock crítico (disponível ≤ limite crítico), juntando os documentos do mesmo produto no mesmo local.
 * Os mais em falta primeiro. O local aparece pelo nome (só quando a empresa tem vários).
 */
export function criticalProducts(products: ReportProduct[], locations: ReportLocation[] = []): CriticalProduct[] {
    const by = new Map<string, CriticalProduct & { stock: number }>();
    for (const p of products) {
        if (p.deletedAt) continue;
        const name = String(p.name || '').trim();
        if (!name) continue;
        const loc = normLoc(p.location);
        const key = `${name}\u0000${loc}`;
        const cur = by.get(key) || { name, location: loc, available: 0, stock: 0, threshold: 0, unit: p.unit };
        cur.available += (Number(p.stock) || 0) - (Number(p.reservedStock) || 0);
        cur.threshold = Math.max(cur.threshold, Number(p.criticalStockThreshold) || 0);
        by.set(key, cur);
    }
    const multi = locations.length > 1;
    const locName = (l: string) => {
        if (!multi) return '';
        if (!l) return locations[0]?.name || 'Principal';
        return locations.find((x) => x.id === l || x.name === l)?.name || l;
    };
    return [...by.values()]
        .filter((p) => p.available <= p.threshold)
        .sort((a, b) => a.available - a.threshold - (b.available - b.threshold) || a.name.localeCompare(b.name))
        .map(({ name, location, available, threshold, unit }) => ({ name, location: locName(location), available, threshold, unit }));
}

/** Texto seguro para pôr no HTML do email (nomes de produtos vêm dos utilizadores). */
export const escapeHtml = (s: string) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * O dia do relatório: o dia de calendário de Maputo (UTC+2), da meia-noite até agora — o mesmo "Hoje" do Financeiro.
 * Antes eram "as últimas 24 horas", que juntavam as vendas da noite anterior.
 */
export function reportDay(now = new Date()) {
    const day = new Date(now.getTime() + 2 * 3600_000).toISOString().slice(0, 10);
    const [y, m, d] = day.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d) - 2 * 3600_000);
    const end = new Date(start.getTime() + 86_400_000 - 1);
    return { day, startISO: start.toISOString(), endISO: end.toISOString(), label: `${pad2(d)}/${pad2(m)}/${y}` };
}

/** A venda é deste dia de Maputo? Datas só com o dia ("2026-10-14") contam como esse dia, como no Financeiro. */
export function saleOnDay(date: unknown, day: string): boolean {
    if (typeof date !== 'string' || !date) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date === day;
    const t = new Date(date).getTime();
    if (isNaN(t)) return false;
    return new Date(t + 2 * 3600_000).toISOString().slice(0, 10) === day;
}

/**
 * Horas a que o relatório pode sair (Maputo). Cada uma tem um cron diário em vercel.json (`?slot=HH:MM`); no plano
 * Hobby da Vercel o cron corre algures dentro dessa hora UTC, por isso o email diz sempre "até às HH:MM".
 */
export const REPORT_TIMES = ['17:30', '18:30', '19:30', '20:30', '21:30', '22:30'] as const;
export type ReportTime = (typeof REPORT_TIMES)[number];
export const DEFAULT_REPORT_TIME: ReportTime = '21:30';

/** A hora escolhida pela empresa (ou a padrão, se não escolheu ou o valor não serve). */
export const reportTime = (v: unknown): ReportTime =>
    (REPORT_TIMES as readonly string[]).includes(String(v)) ? (v as ReportTime) : DEFAULT_REPORT_TIME;

/** "21:30" → "21h30" para mostrar. */
export const reportTimeLabel = (t: string) => t.replace(':', 'h');
