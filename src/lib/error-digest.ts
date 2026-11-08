// Resumo diário para o dono da plataforma: os erros que os clientes apanharam nas últimas 24 h (agrupados por
// mensagem), pagamentos que falharam e as empresas que começaram o teste. Chega por email todas as manhãs, mesmo
// sem erros ("tudo bem" também é informação). Puro, para ser testado.
import { escapeHtml } from '@/lib/daily-report';

export type ErrorLogLite = { message: string; url?: string; companyId?: string | null; email?: string | null; at: number };
export type BillingFailLite = { event: string; error: string; at: string };
export type NewCompanyLite = { id: string; name: string };

export type ErrorGroup = { message: string; count: number; companies: string[]; users: number; lastUrl?: string; lastAt: number };

/** O mesmo erro com números ou códigos diferentes conta como um só ("Documento abc123 não existe" ≈ "Documento xyz789 não existe"). */
export const errorKey = (message: string) =>
    String(message || '').replace(/\b[0-9a-f]{8,}\b/gi, '#').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 160);

export function groupErrors(errors: ErrorLogLite[]): ErrorGroup[] {
    const by = new Map<string, ErrorGroup & { userSet: Set<string> }>();
    for (const e of errors) {
        const key = errorKey(e.message);
        const g = by.get(key) || { message: String(e.message || '').slice(0, 300), count: 0, companies: [], users: 0, lastAt: 0, userSet: new Set<string>() };
        g.count++;
        if (e.companyId && !g.companies.includes(e.companyId)) g.companies.push(e.companyId);
        if (e.email) g.userSet.add(e.email);
        if (e.at >= g.lastAt) { g.lastAt = e.at; g.lastUrl = e.url || g.lastUrl; }
        by.set(key, g);
    }
    return [...by.values()]
        .map(({ userSet, ...g }) => ({ ...g, users: userSet.size }))
        .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Hora de Maputo (UTC+2): "17/10 14:05". */
export function maputoTime(ms: number): string {
    const d = new Date(ms + 2 * 3600_000);
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function buildErrorDigest(args: {
    errors: ErrorLogLite[];
    billing: BillingFailLite[];
    newCompanies: NewCompanyLite[];
    companyNames: Record<string, string>;
    appUrl?: string;
}): { subject: string; html: string; total: number; groups: ErrorGroup[] } {
    const { errors, billing, newCompanies, companyNames } = args;
    const appUrl = args.appUrl || 'https://stock.majorgroup.app';
    const groups = groupErrors(errors);
    const total = errors.length + billing.length;
    const subject = total === 0
        ? `✅ MajorStockX: sem erros nas últimas 24 h${newCompanies.length ? ` · ${newCompanies.length} novo${newCompanies.length === 1 ? '' : 's'} em teste` : ''}`
        : `⚠️ MajorStockX: ${errors.length} erro${errors.length === 1 ? '' : 's'}${groups.length > 1 ? ` (${groups.length} tipos)` : ''}${billing.length ? ` · ${billing.length} pagamento${billing.length === 1 ? '' : 's'} com erro` : ''} nas últimas 24 h`;

    const name = (id: string) => escapeHtml(companyNames[id] || id);
    const cell = 'padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px';
    const parts: string[] = [];
    parts.push(`<div style="font-family:Arial,sans-serif;color:#111;max-width:680px">`);
    parts.push(`<h2 style="margin:0 0 4px">${total === 0 ? '✅ Tudo a funcionar' : '⚠️ Erros nas últimas 24 horas'}</h2>`);
    parts.push(`<p style="margin:0 0 16px;color:#555;font-size:13px">${total === 0 ? 'Nenhum cliente apanhou erros nas últimas 24 horas.' : 'O que os clientes apanharam no ecrã, do mais frequente para o menos.'}</p>`);

    if (groups.length) {
        parts.push(`<table style="border-collapse:collapse;width:100%"><tr><th style="${cell};text-align:left">Erro</th><th style="${cell}">Vezes</th><th style="${cell};text-align:left">Empresas</th><th style="${cell}">Último</th></tr>`);
        for (const g of groups.slice(0, 15)) {
            const where = g.lastUrl ? `<div style="color:#888;font-size:11px">${escapeHtml(g.lastUrl.replace(/^https?:\/\/[^/]+/, ''))}</div>` : '';
            const companies = g.companies.length ? g.companies.slice(0, 3).map(name).join(', ') + (g.companies.length > 3 ? ` +${g.companies.length - 3}` : '') : '<span style="color:#888">antes de entrar</span>';
            parts.push(`<tr><td style="${cell}">${escapeHtml(g.message)}${where}</td><td style="${cell};text-align:center"><b>${g.count}</b></td><td style="${cell}">${companies}</td><td style="${cell};white-space:nowrap">${maputoTime(g.lastAt)}</td></tr>`);
        }
        parts.push(`</table>`);
        if (groups.length > 15) parts.push(`<p style="font-size:12px;color:#555">E mais ${groups.length - 15} tipos de erro.</p>`);
        parts.push(`<p style="margin:12px 0"><a href="${appUrl}/admin/errors" style="color:#2563eb">Ver os detalhes na página de erros</a></p>`);
    }

    if (billing.length) {
        parts.push(`<h3 style="margin:20px 0 6px">💳 Pagamentos com erro</h3><ul style="margin:0;padding-left:18px;font-size:13px">`);
        for (const b of billing.slice(0, 10)) parts.push(`<li>${escapeHtml(maputoTime(Date.parse(b.at)))} · ${escapeHtml(b.event)}: ${escapeHtml(b.error)}</li>`);
        parts.push(`</ul>`);
    }

    if (newCompanies.length) {
        parts.push(`<h3 style="margin:20px 0 6px">🆕 Começaram o teste</h3><p style="margin:0;font-size:13px">${newCompanies.slice(0, 20).map((c) => escapeHtml(c.name || c.id)).join(', ')}${newCompanies.length > 20 ? ` e mais ${newCompanies.length - 20}` : ''}</p>`);
    }

    parts.push(`<p style="margin-top:24px;color:#999;font-size:11px">Resumo automático das 06:00 (Maputo).</p></div>`);
    return { subject, html: parts.join(''), total, groups };
}
