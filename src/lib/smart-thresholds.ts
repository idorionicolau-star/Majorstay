// Limites de stock sugeridos (baixo / crítico) a partir do consumo real.
// Corre na própria app — antes chamava um script Python que o Vercel não executa,
// por isso as sugestões nunca eram actualizadas.

export type ThresholdInput = {
    products: { id?: string; name?: string; location?: string; thresholdMode?: string; lowStockThreshold?: number; criticalStockThreshold?: number }[];
    movements: { type?: string; reason?: string; productName?: string; fromLocationId?: string; location?: string; quantity?: number; timestamp?: unknown; date?: unknown }[];
    sales: { productName?: string; location?: string; quantity?: number; date?: unknown; status?: string }[];
    now?: Date;
};

export type ThresholdPrediction = {
    id: string;
    name: string;
    location: string;
    ads: number;
    targetStock: number;
    lowStockThreshold: number;
    criticalStockThreshold: number;
    mode: 'statistical' | 'slow' | 'kept';
};

const Z = 1.65; // 90% de nível de serviço
const SHORT = 30; // janela principal
const LONG = 90; // janela para artigos de saída lenta
const MIN_DAYS_STATS = 3;

const norm = (s?: string) => (s || '').trim().toLowerCase();

function toDate(v: unknown): Date | null {
    if (!v) return null;
    const x = v as { toDate?: () => Date; seconds?: number };
    let d: Date;
    if (typeof x.toDate === 'function') d = x.toDate();
    else if (typeof x.seconds === 'number') d = new Date(x.seconds * 1000);
    else if (typeof v === 'number') d = new Date(v > 1e11 ? v : v * 1000);
    else d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const mean = (a: number[]) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);
const std = (a: number[], m = mean(a)) => Math.sqrt(mean(a.map((x) => (x - m) ** 2)));

export function computeSmartThresholds({ products, movements, sales, now = new Date() }: ThresholdInput): ThresholdPrediction[] {
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const cutoff = today.getTime() - (LONG - 1) * 86_400_000;

    // consumo por (produto, local) e por dia
    const history = new Map<string, Map<string, number>>();
    const add = (name: string, loc: string, date: Date | null, qty: number) => {
        if (!date || !qty || date.getTime() < cutoff) return;
        const key = `${norm(name)}|${norm(loc)}`;
        const days = history.get(key) || new Map<string, number>();
        days.set(dayKey(date), (days.get(dayKey(date)) || 0) + qty);
        history.set(key, days);
    };

    for (const s of sales) {
        if (s.status === 'Pendente') continue; // proforma não é consumo
        add(s.productName || '', s.location || 'Principal', toDate(s.date), Math.abs(Number(s.quantity) || 0));
    }
    for (const m of movements) {
        if (m.type !== 'OUT') continue;
        const reason = m.reason || '';
        if (/venda|levantamento/i.test(reason)) continue; // já contado nas vendas
        add(m.productName || '', m.fromLocationId || m.location || 'Principal', toDate(m.timestamp ?? m.date), Math.abs(Number(m.quantity) || 0));
    }

    const out: ThresholdPrediction[] = [];
    for (const p of products) {
        if (!p.id || p.thresholdMode === 'manual') continue;
        const name = (p.name || '').trim();
        const loc = p.location || 'Principal';
        const days = history.get(`${norm(name)}|${norm(loc)}`);

        const series = (n: number) => Array.from({ length: n }, (_, i) => days?.get(dayKey(new Date(today.getTime() - i * 86_400_000))) || 0);
        const d30 = series(SHORT);
        const d90 = series(LONG);
        const days30 = d30.filter((x) => x > 0).length;
        const days90 = d90.filter((x) => x > 0).length;

        let ads = 0;
        let target = 0;
        let mode: ThresholdPrediction['mode'];

        if (days30 >= MIN_DAYS_STATS) {
            // Estatístico: corta picos, média ponderada (recente pesa mais), stock de segurança
            // O corte usa a mediana dos dias com venda: um pico (obra grande, venda única) infla a média
            // e o desvio-padrão e passava pelo corte antigo (média + 2,5 desvios), inflacionando o limite.
            const active = d30.filter((x) => x > 0).sort((a, b) => a - b);
            const median = active[Math.floor(active.length / 2)];
            const cap = median * 4;
            const f = d30.map((x) => Math.min(x, cap));
            ads = (mean(f.slice(0, 7)) * 0.5) + (mean(f.slice(7, 14)) * 0.3) + (mean(f.slice(14, 30)) * 0.2);
            const fAvg = mean(f);
            const fStd = std(f, fAvg);
            const cv = fAvg > 0 ? fStd / fAvg : 1;
            const lead = ads < 1 ? 7 : ads < 3 ? 10 : 14;
            const base = ads * lead;
            const raw = Z * fStd * Math.sqrt(lead) * (1 + Math.min(cv, 1));
            const safety = ads > 0.5 ? Math.min(raw, base * 2) : raw;
            target = Math.max(Math.ceil(base + safety), 4);
            mode = 'statistical';
        } else if (days90 >= 2) {
            // Saída lenta: usa 90 dias para não ficar sem alerta só porque o último mês foi parado
            ads = mean(d90);
            // nunca baixa abaixo do limite que o utilizador já tinha: pouco giro não quer dizer pouco risco
            target = Math.max(3, Math.ceil(ads * 14 * 1.5), Number(p.lowStockThreshold) || 0);
            mode = 'slow';
        } else {
            // Sem histórico suficiente: não inventa — mantém o que o utilizador já tinha
            const low = Number(p.lowStockThreshold) || 0;
            const crit = Number(p.criticalStockThreshold) || 0;
            target = low > 0 ? low : 3;
            out.push({
                id: p.id, name, location: loc, ads: 0, targetStock: target,
                lowStockThreshold: target,
                criticalStockThreshold: crit > 0 && crit < target ? crit : Math.max(2, Math.ceil(target * 0.4)),
                mode: 'kept',
            });
            continue;
        }

        const low = target;
        const existingCrit = Number(p.criticalStockThreshold) || 0;
        out.push({
            id: p.id, name, location: loc, ads: Math.round(ads * 1000) / 1000,
            targetStock: target, lowStockThreshold: low,
            criticalStockThreshold: mode === 'slow' && existingCrit > 0 && existingCrit < low ? existingCrit : Math.max(2, Math.ceil(low * 0.4)),
            mode,
        });
    }
    return out;
}
