// Contagem por fotografia com a IA do próprio utilizador (Gemini, Claude…):
// o programa dá a instrução já com a lista dos produtos, a pessoa cola a resposta,
// e aqui lê-se o texto e liga-se cada linha a um produto — sem IA nossa, sem custo.
import type { Product } from "@/lib/types";
import { calculateSimilarity, normalizeString } from "@/lib/utils";

export type PastedRow = { raw: string; name: string; qty: number | null };

export type CountMatch = {
    raw: string;
    name: string;
    qty: number | null;
    status: "ok" | "doubt" | "missing";
    /** produto escolhido (o certo, ou o mais provável nos duvidosos) */
    product: Product | null;
    /** outras hipóteses para os duvidosos */
    candidates: Product[];
    /** quantas linhas da resposta foram somadas neste produto */
    merged: number;
    reason?: string;
};

export function buildCountPrompt(products: Pick<Product, "name" | "unit">[], locationName?: string) {
    const names = Array.from(new Set(products.map((p) => p.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt"));
    return [
        "Vou enviar fotografia(s) de uma contagem de stock (folha escrita à mão ou impressa)" + (locationName ? ` do local "${locationName}"` : "") + ".",
        "Transcreve TODAS as linhas de todas as fotografias, sem saltar nenhuma.",
        "",
        "Responde APENAS com uma linha por produto, neste formato exacto:",
        "Nome do produto | quantidade",
        "",
        "Regras:",
        "- Quando o produto da folha corresponder a um da lista abaixo, escreve o nome EXACTAMENTE como está na lista.",
        "- Se não estiver na lista, escreve o nome tal como está na folha.",
        "- A quantidade é só o número (sem unidades). Usa vírgula para decimais.",
        "- Se não conseguires ler um número com certeza, escreve ? no lugar da quantidade.",
        "- Não somes nem juntes linhas; não acrescentes títulos, totais, explicações nem tabelas.",
        "",
        `Lista dos produtos (${names.length}):`,
        ...names,
    ].join("\n");
}

const NUM = String.raw`(\d{1,3}(?:[ .]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?|\?)`;

const toQty = (raw: string): number | null => {
    if (raw === "?") return null;
    let s = raw.trim();
    // 1.200 / 1 200 = mil e duzentos; 12,5 = doze e meio
    if (/^\d{1,3}([ .]\d{3})+(,\d+)?$/.test(s)) s = s.replace(/[ .]/g, "");
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Lê a resposta colada: "Nome | 12", "Nome: 12", "- Nome — 12 un", tabelas markdown, "12 x Nome"… */
export function parsePastedCount(text: string): PastedRow[] {
    const rows: PastedRow[] = [];
    for (const original of text.split(/\r?\n/)) {
        let line = original.trim();
        if (!line) continue;
        if (/^\|?\s*:?-{2,}/.test(line)) continue; // separador de tabela markdown
        line = line.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, ""); // marcadores de lista
        line = line.replace(/\*\*/g, "").replace(/`/g, "");
        // tabela markdown: | nome | 12 |
        if (line.startsWith("|")) {
            const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
            if (cells.length >= 2) line = `${cells[0]} | ${cells[cells.length - 1]}`;
        }
        let m = line.match(new RegExp(`^(.+?)\\s*(?:\\||;|:|=|\\t|—|–|-)\\s*${NUM}\\s*[a-zA-Zµ²³.]{0,8}$`));
        if (!m) m = line.match(new RegExp(`^(.+?)\\s+${NUM}\\s*[a-zA-Zµ²³.]{0,8}$`));
        let name: string, qtyRaw: string;
        if (m) { name = m[1]; qtyRaw = m[2]; }
        else {
            const r = line.match(new RegExp(`^${NUM}\\s*[x×*]?\\s+(.+)$`, "i"));
            if (!r) continue;
            name = r[2]; qtyRaw = r[1];
        }
        name = name.replace(/\s*[|;:=—–-]\s*$/, "").trim();
        const n = normalizeString(name);
        if (!name || /^(produto|nome|artigo|descri[cç][aã]o|total)s?$/.test(n)) continue;
        rows.push({ raw: original.trim(), name, qty: toQty(qtyRaw) });
    }
    return rows;
}

// "20 x 40", "20X40" e "20×40" são a mesma medida
const words = (s: string) => normalizeString(s).replace(/(\d)\s*[x×*]\s*(\d)/g, "$1x$2").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function score(name: string, p: Product) {
    const a = words(name);
    const b = words(p.name);
    if (a === b) return 1;
    const sim = calculateSimilarity(a, b);
    // as mesmas palavras e números, por outra ordem ("40x15 bloco" / "Bloco 15x40")
    const ta = new Set(a.split(" "));
    const tb = new Set(b.split(" "));
    const common = [...ta].filter((t) => tb.has(t)).length;
    const overlap = common / Math.max(ta.size, tb.size);
    // números diferentes = produto diferente (Bloco 15 ≠ Bloco 20)
    const na = a.match(/\d+/g)?.join(" ") || "";
    const nb = b.match(/\d+/g)?.join(" ") || "";
    const numbersDiffer = na !== nb && (na !== "" || nb !== "");
    const s = Math.max(sim, overlap);
    return numbersDiffer ? s * 0.6 : s;
}

/** Liga cada linha a um produto do local. Linhas do mesmo produto somam-se (o mesmo artigo em dois sítios). */
export function matchCountRows(rows: PastedRow[], products: Product[]): CountMatch[] {
    const out: CountMatch[] = [];
    const byProduct = new Map<string, CountMatch>();
    for (const r of rows) {
        const ranked = products
            .map((p) => ({ p, s: score(r.name, p) }))
            .filter((x) => x.s >= 0.45)
            .sort((a, b) => b.s - a.s);
        const best = ranked[0];
        const second = ranked[1];
        let status: CountMatch["status"] = "missing";
        let reason: string | undefined;
        if (best) {
            const clear = best.s >= 0.97 || (best.s >= 0.85 && (!second || best.s - second.s >= 0.15));
            status = clear ? "ok" : "doubt";
            if (!clear) reason = second && best.s - second.s < 0.15 ? "Há mais de um produto parecido" : "Nome parecido, confirme";
        }
        if (status !== "missing" && r.qty == null) { status = "doubt"; reason = "Quantidade ilegível"; }

        const product = best?.p || null;
        const key = product ? (product.instanceId || product.id || product.name) : "";
        const prev = key && status === "ok" ? byProduct.get(key) : undefined;
        if (prev && prev.status === "ok" && r.qty != null && prev.qty != null) {
            prev.qty += r.qty;
            prev.merged += 1;
            prev.raw += `\n${r.raw}`;
            continue;
        }
        const m: CountMatch = {
            raw: r.raw, name: r.name, qty: r.qty, status, product: status === "missing" ? null : product,
            candidates: ranked.slice(0, 4).map((x) => x.p), merged: 1, reason,
        };
        out.push(m);
        if (key && status === "ok") byProduct.set(key, m);
    }
    return out;
}
