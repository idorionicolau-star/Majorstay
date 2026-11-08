import { evalQty } from "@/lib/calc";
import {
    collection,
    doc,
    increment,
    serverTimestamp,
    writeBatch,
    type Firestore,
} from "firebase/firestore";
import type { Product, StockMovement } from "@/lib/types";
import { normalizeString } from "@/lib/utils";

export type QuickMode = "in" | "out" | "count";

export type QuickLine = {
    /** name|location — stable key used to merge repeated entries */
    key: string;
    name: string;
    location: string;
    /** Firestore doc ids behind this (possibly merged) product. Empty when isNew. */
    sourceIds: string[];
    /** Stock the system had when the line was created (for previews and audits) */
    systemStock: number;
    reservedStock: number;
    unit: string;
    /** Quantity entered / removed, or the physical count in count mode */
    qty: number;
    isNew?: boolean;
    price?: number;
    /** Categoria escolhida para um produto novo (a sugerida pelo nome, ou a que a pessoa escolheu). */
    category?: string;
    /** Produto novo: acrescentar também ao catálogo (para aparecer em vendas, produção, etc.). */
    addToCatalog?: boolean;
    /** A categoria ainda não existe no catálogo: criá-la. */
    addCategory?: boolean;
    /** Produto novo criado com um código de barras (lido ou escrito): grava-se no stock e no catálogo. */
    barcode?: string;
    /** Variação de uma família ("Pavê - Vermelho"): o nome base e o valor de cada tipo. Ver lib/variants.ts */
    variantGroup?: string;
    variantValues?: Record<string, string>;
    /** When the product already exists in another location: copy its data instead of creating a bare one. */
    template?: Pick<Product, "category" | "price" | "cost" | "unit" | "lowStockThreshold" | "criticalStockThreshold" | "imageUrl" | "barcode">;
};

export const lineKey = (name: string, location: string) =>
    `${normalizeString(name.trim())}|${location || ""}`;

export const toNumber = (raw: string): number => {
    // também aceita contas: "120+35+48" → 203, "12x8" → 96 (ver lib/calc.ts)
    const v = evalQty(raw);
    if (Number.isFinite(v)) return v;
    const n = parseFloat(String(raw).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
};

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

/**
 * Splits what the user typed into a product search term and an optional quantity.
 *   "bloco 15 x 200"  -> { term: "bloco 15", qty: 200 }
 *   "200x bloco 15"   -> { term: "bloco 15", qty: 200 }
 *   "cimento 20"      -> { term: "cimento", qty: 20 }   (unless a product is literally called "... 20")
 *   "20 cimento"      -> { term: "cimento", qty: 20 }
 */
export function parseQuickInput(
    input: string,
    productNames: string[]
): { term: string; qty: number | null } {
    const text = input.trim().replace(/\s+/g, " ");
    if (!text) return { term: "", qty: null };

    // If the text is a complete product name (or its start, ending on a word boundary),
    // e.g. "Bloco 15" or "Bloco 15x40", it is a name — not name + quantity.
    const norm = normalizeString(text);
    const esc = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word start only: "cimento 32" is the start of "Cimento 32.5N" → it is a name, not 32 bags.
    // A wrong quantity is worse than asking for it, so ambiguity resolves to "name".
    const boundary = new RegExp(`(^|\\s)${esc}`);
    if (productNames.some((n) => boundary.test(normalizeString(n)))) return { term: text, qty: null };

    // Explicit multiplier: "nome x 20", "nome *20", "20x nome"
    let m = text.match(new RegExp(`^(.+?)\\s*[x×*]\\s*${NUM}$`, "i"));
    if (m && m[1].trim()) return { term: m[1].trim(), qty: toNumber(m[2]) };
    m = text.match(new RegExp(`^${NUM}\\s*[x×*]\\s*(.+)$`, "i"));
    if (m && m[2].trim()) return { term: m[2].trim(), qty: toNumber(m[1]) };

    // Plain trailing or leading number: "cimento 20", "20 cimento"
    m = text.match(new RegExp(`^(.+?)\\s+${NUM}$`));
    if (m) return { term: m[1].trim(), qty: toNumber(m[2]) };
    m = text.match(new RegExp(`^${NUM}\\s+(.+)$`));
    if (m) return { term: m[2].trim(), qty: toNumber(m[1]) };

    return { term: text, qty: null };
}

// Palavras de ligação: numa pesquisa são opcionais ("blocos de 15" encontra "Bloco 15").
const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'um', 'uma', 'para', 'com', 'em', 'no', 'na', 'tipo']);

/** Formas de uma palavra no singular/plural ("blocos" → bloco, "colheres" → colher, "paes" → pao, "leões" → leao). */
function wordForms(tok: string): string[] {
    const forms = [tok];
    if (tok.length > 3) {
        if (tok.endsWith('oes')) forms.push(tok.slice(0, -3) + 'ao');
        if (tok.endsWith('aes')) forms.push(tok.slice(0, -3) + 'ao');
        if (tok.endsWith('ns')) forms.push(tok.slice(0, -2) + 'm');
        if (tok.endsWith('es')) forms.push(tok.slice(0, -2));
        if (tok.endsWith('s')) forms.push(tok.slice(0, -1));
    }
    return forms;
}

function editDistance(a: string, b: string): number {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return m[a.length][b.length];
}

/** Uma palavra do que se procura "é" uma palavra do nome se for igual, parecida (plural) ou tiver 1–2 letras trocadas (ditado). */
function fuzzyWord(tok: string, nameWords: string[]): boolean {
    return wordForms(tok).some((f) => nameWords.some((w) => {
        if (w === f || (f.length >= 3 && w.startsWith(f))) return true;
        if (Math.min(w.length, f.length) < 4) return false;
        return editDistance(w, f) <= (Math.max(w.length, f.length) >= 9 ? 2 : 1);
    }));
}

/**
 * Pesquisa de produtos (teclado e voz). Cada palavra tem de existir no nome — mas "blocos" encontra "Bloco 15",
 * as palavras de ligação ("de", "para") não contam, e se nada bater, tolera uma ou duas letras trocadas
 * (o que o ditado costuma errar). Começos de nome primeiro.
 */
export function searchProducts<T extends { name: string }>(products: T[], term: string, limit = 8, fuzzy = true): T[] {
    const t = normalizeString(term.trim()).replace(/[()\[\]{}"'`´]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return [];
    const all = t.split(" ").filter(Boolean);
    // "de" só se ignora se houver mais palavras; uma pesquisa só de ligações continua a funcionar como antes
    const tokens = all.filter((w) => !STOP.has(w));
    const toks = tokens.length ? tokens : all;

    const run = (match: (name: string, words: string[], tok: string) => boolean) => {
        const scored: { p: T; score: number }[] = [];
        for (const p of products) {
            const name = normalizeString(p.name);
            const words = name.split(/[^a-z0-9.,]+/).filter(Boolean);
            if (!toks.every((tok) => match(name, words, tok))) continue;
            let score = 0;
            if (name === t) score += 100;
            if (name.startsWith(t)) score += 50;
            if (name.startsWith(toks[0])) score += 20;
            if (words.some((w) => w.startsWith(toks[0]))) score += 10;
            score -= name.length / 100; // nomes mais curtos primeiro em empate
            scored.push({ p, score });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit).map((s) => s.p);
    };

    const exact = run((name, _w, tok) => wordForms(tok).some((f) => name.includes(f)));
    if (exact.length || !fuzzy) return exact;
    // Sem resultados: tolera erros de ditado. Só em palavras (não em números: "Bloco 15" ≠ "Bloco 20").
    return run((name, words, tok) => (/\d/.test(tok) ? name.includes(tok) : fuzzyWord(tok, words)));
}

/**
 * O produto certo para o que se disse, ou nenhum se houver dúvida. Por voz não se pode adivinhar:
 * "bloco" com "Bloco 15" e "Bloco 20" no inventário deve perguntar, não somar ao primeiro.
 */
export function pickVoiceMatch(products: Product[], term: string, fuzzy = true): { hit?: Product; ambiguous: Product[] } {
    const hits = searchProducts(products, term, 4, fuzzy);
    if (hits.length <= 1) return { hit: hits[0], ambiguous: [] };
    const t = normalizeString(term.trim());
    const exact = hits.find((h) => normalizeString(h.name) === t);
    return exact ? { hit: exact, ambiguous: [] } : { ambiguous: hits };
}

export function lineFromProduct(p: Product, qty: number): QuickLine {
    return {
        key: lineKey(p.name, p.location || ""),
        name: p.name,
        location: p.location || "",
        sourceIds: p.sourceIds?.length ? p.sourceIds : p.id ? [p.id] : [],
        systemStock: p.stock || 0,
        reservedStock: p.reservedStock || 0,
        unit: p.unit || "un",
        qty,
        price: p.price,
    };
}

/** Resulting stock after applying a line, for previews. */
export function resultingStock(mode: QuickMode, line: QuickLine): number {
    if (mode === "count") return line.qty;
    if (mode === "out") return line.systemStock - line.qty;
    return line.systemStock + line.qty;
}

const REASON_DEFAULT: Record<QuickMode, string> = {
    in: "Entrada rápida",
    out: "Saída rápida",
    count: "Contagem rápida",
};

type CommitArgs = {
    firestore: Firestore;
    companyId: string;
    user: { id: string; username: string };
    mode: QuickMode;
    lines: QuickLine[];
    note?: string;
};

/**
 * Writes all lines in as few round-trips as possible (Firestore batches of ≤ 450 ops).
 * Entries/exits use atomic increments, so two people working at once never overwrite each other.
 * Returns true when confirmed by the server, false when queued offline (it will sync later).
 */
export async function commitQuickStock({ firestore, companyId, user, mode, lines, note }: CommitArgs): Promise<boolean> {
    const productsRef = collection(firestore, `companies/${companyId}/products`);
    const movementsRef = collection(firestore, `companies/${companyId}/stockMovements`);
    const now = new Date().toISOString();
    const reason = note?.trim() ? `${REASON_DEFAULT[mode]}: ${note.trim()}` : REASON_DEFAULT[mode];

    const batches = [writeBatch(firestore)];
    let ops = 0;
    const next = (needed: number) => {
        if (ops + needed > 450) {
            batches.push(writeBatch(firestore));
            ops = 0;
        }
        ops += needed;
        return batches[batches.length - 1];
    };

    for (const line of lines) {
        if (!(line.qty >= 0) || (mode !== "count" && line.qty === 0)) continue;

        if (line.isNew || line.sourceIds.length === 0) {
            const b = next(2);
            const ref = doc(productsRef);
            const stock = mode === "out" ? 0 : line.qty;
            const t = line.template;
            b.set(ref, {
                name: line.name.trim(),
                category: line.category || t?.category || "Geral",
                price: line.price || t?.price || 0,
                cost: t?.cost || 0,
                unit: t?.unit || line.unit || "un",
                stock,
                reservedStock: 0,
                location: line.location || "",
                lowStockThreshold: t?.lowStockThreshold || 0,
                criticalStockThreshold: t?.criticalStockThreshold || 0,
                ...(t?.imageUrl ? { imageUrl: t.imageUrl } : {}),
                ...((line.barcode || t?.barcode) ? { barcode: line.barcode || t?.barcode } : {}),
                ...(line.variantGroup ? { variantGroup: line.variantGroup, variantValues: line.variantValues || {} } : {}),
                lastUpdated: now,
            });
            const movement: Omit<StockMovement, "id" | "timestamp"> = {
                productId: ref.id,
                productName: line.name.trim(),
                type: "IN",
                quantity: stock,
                toLocationId: line.location || "",
                reason: t ? `${reason} (primeira vez nesta localização)` : `${reason} (novo produto)`,
                userId: user.id,
                userName: user.username,
            };
            b.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });
            continue;
        }

        const [primaryId, ...others] = line.sourceIds;
        const b = next(2 + (mode === "count" ? others.length : 0));
        const primaryRef = doc(productsRef, primaryId);

        let movement: Omit<StockMovement, "id" | "timestamp">;
        if (mode === "count") {
            // A reserva dos documentos repetidos passa para o principal antes de os zerar.
            b.update(primaryRef, { stock: line.qty, ...(others.length ? { reservedStock: line.reservedStock } : {}), lastUpdated: now });
            for (const id of others) b.update(doc(productsRef, id), { stock: 0, reservedStock: 0, lastUpdated: now });
            movement = {
                productId: primaryId,
                productName: line.name,
                type: "ADJUSTMENT",
                quantity: line.qty - line.systemStock,
                toLocationId: line.location,
                reason,
                userId: user.id,
                userName: user.username,
                isAudit: true,
                systemCountBefore: line.systemStock,
                physicalCount: line.qty,
            };
        } else {
            const delta = mode === "in" ? line.qty : -line.qty;
            b.update(primaryRef, { stock: increment(delta), lastUpdated: now });
            movement = {
                productId: primaryId,
                productName: line.name,
                type: mode === "in" ? "IN" : "OUT",
                quantity: delta,
                ...(mode === "in" ? { toLocationId: line.location } : { fromLocationId: line.location }),
                reason,
                userId: user.id,
                userName: user.username,
            };
        }
        b.set(doc(movementsRef), { ...movement, timestamp: serverTimestamp() });
    }

    // Catálogo: produto novo e categoria nova. Fica num lote à parte: quem só tem permissão de inventário
    // não pode escrever no catálogo, e isso nunca deve impedir a entrada de stock.
    const catalogBatch = writeBatch(firestore);
    let catalogOps = 0;
    const newCategories = new Set<string>();
    for (const line of lines) {
        if (!line.isNew || !(line.qty >= 0)) continue;
        const category = line.category || line.template?.category || "Geral";
        if (line.addToCatalog) {
            const t = line.template;
            catalogBatch.set(doc(collection(firestore, `companies/${companyId}/catalogProducts`)), {
                name: line.name.trim(),
                category,
                price: line.price || t?.price || 0,
                unit: t?.unit || line.unit || "un",
                lowStockThreshold: t?.lowStockThreshold || 0,
                criticalStockThreshold: t?.criticalStockThreshold || 0,
                ...(line.barcode ? { barcode: line.barcode } : {}),
                ...(line.variantGroup ? { variantGroup: line.variantGroup, variantValues: line.variantValues || {} } : {}),
            });
            catalogOps++;
        }
        if (line.addCategory && !newCategories.has(category.toLowerCase())) {
            newCategories.add(category.toLowerCase());
            catalogBatch.set(doc(collection(firestore, `companies/${companyId}/catalogCategories`)), { name: category });
            catalogOps++;
        }
    }
    if (catalogOps) {
        catalogBatch.commit().catch((e) => console.warn("Catálogo não actualizado (sem permissão?):", e));
    }

    // With the persistent local cache the writes are applied locally at once;
    // the promise only resolves when the server confirms. Don't block the user on a bad connection.
    const all = Promise.all(batches.map((b) => b.commit()));
    const timeout = new Promise<"queued">((r) => setTimeout(() => r("queued"), 5000));
    const result = await Promise.race([all.then(() => "ok" as const), timeout]);
    all.catch((e) => console.error("Quick stock commit failed", e));
    return result === "ok";
}
