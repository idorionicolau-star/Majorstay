// Importar uma lista de produtos de QUALQUER fonte: tabela (CSV, Excel), texto colado (Excel, WhatsApp, lista)
// ou a resposta de uma IA a quem se deu um PDF/fotografia. É puro (sem Firebase nem React) para poder ser testado.
//
// Reconhece colunas pelo nome (sinónimos), e quando não há cabeçalho adivinha: a coluna de texto é o nome,
// a coluna de números é o preço. Em texto livre apanha "Nome ... preço" e títulos de categoria.
import { cleanProductName, findNameMatches, nameKey } from '@/lib/new-product';

export type ImportRow = {
    name: string;
    category?: string;
    price?: number;
    cost?: number;
    unit?: string;
    code?: string;
    imageUrl?: string;
};

type Field = 'name' | 'category' | 'price' | 'cost' | 'unit' | 'code' | 'image';

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const norm = (s: unknown) => strip(String(s ?? '')).replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();

const SYNONYMS: Record<Field, string[]> = {
    name: ['nome', 'produto', 'produtos', 'artigo', 'artigos', 'descricao', 'designacao', 'denominacao', 'item', 'material', 'nome do produto', 'nome do artigo', 'name', 'product', 'description', 'title', 'titulo'],
    category: ['categoria', 'familia', 'grupo', 'seccao', 'departamento', 'linha', 'tipo', 'category', 'group', 'section'],
    price: ['preco', 'preco de venda', 'preco venda', 'preco unitario', 'preco un', 'preco publico', 'pvp', 'p v p', 'valor', 'valor unitario', 'venda', 'price', 'unit price', 'selling price', 'mts', 'mt', 'mzn'],
    cost: ['custo', 'preco de custo', 'preco custo', 'custo unitario', 'cost', 'compra', 'preco de compra'],
    unit: ['unidade', 'un', 'und', 'unid', 'medida', 'unit', 'uom', 'unidade de medida'],
    code: ['codigo', 'cod', 'ref', 'referencia', 'sku', 'codigo de barras', 'barcode', 'ean', 'code'],
    image: ['imagem', 'foto', 'fotografia', 'imagem url', 'url imagem', 'image', 'image url', 'photo', 'picture', 'link da imagem'],
};
// colunas que nunca são o preço de venda (o catálogo de um revendedor traz o preço de revenda ao lado)
const IGNORED_HEADERS = /revenda|desconto|\bdes\b|\biva\b|\bvat\b|total|subtotal|margem|lucro|stock|quantidade|\bqtd?\b|alerta/;

function fieldOf(header: string): { field: Field; score: number } | null {
    const h = norm(header);
    if (!h || IGNORED_HEADERS.test(h)) return null;
    let best: { field: Field; score: number } | null = null;
    for (const field of Object.keys(SYNONYMS) as Field[]) {
        for (const syn of SYNONYMS[field]) {
            let score = 0;
            if (h === syn) score = 3;
            else if (syn.length >= 4 && (h.startsWith(syn + ' ') || h.endsWith(' ' + syn))) score = 2;
            else if (syn.length >= 5 && h.includes(syn)) score = 1;
            if (score && (!best || score > best.score)) best = { field, score };
        }
    }
    return best;
}

// ---------------------------------------------------------------- preços

/** "7.200 Mts" → 7200 · "1.234,50" → 1234.5 · "297,50" → 297.5 · "12.5" → 12.5 · "abc" → null */
export function parsePrice(raw: unknown): number | null {
    if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
    let s = String(raw ?? '').trim();
    if (!s) return null;
    s = s.replace(/\b(meticais|metical|mzn|mts|mt|usd|eur|kz|aoa|zar|r\$)\b\.?/gi, '').replace(/[€$]/g, '').replace(/\s+/g, ' ').trim();
    if (!/^\d[\d.,\s]*$/.test(s)) return null;
    let n: number;
    if (/^\d{1,3}([. ]\d{3})+(,\d{1,2})?$/.test(s)) n = parseFloat(s.replace(/[. ]/g, '').replace(',', '.'));
    else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) n = parseFloat(s.replace(/,/g, ''));
    else if (/^\d+,\d{1,2}$/.test(s)) n = parseFloat(s.replace(',', '.'));
    else if (/^\d+(\.\d+)?$/.test(s)) n = parseFloat(s);
    else return null;
    return Number.isFinite(n) ? n : null;
}

const isNumeric = (v: unknown) => parsePrice(v) !== null;
const hasLetters = (v: unknown) => /\p{L}{2,}/u.test(String(v ?? ''));

// ---------------------------------------------------------------- tabelas

/** Linhas de uma tabela (a primeira pode ser o cabeçalho) → produtos. */
export function rowsFromTable(table: unknown[][]): ImportRow[] {
    const grid = table.map((r) => r.map((c) => (c == null ? '' : String(c).trim()))).filter((r) => r.some(Boolean));
    if (!grid.length) return [];

    // 1) cabeçalho: a 1.ª linha (das primeiras 8) com uma coluna de nome e mais alguma coisa reconhecida
    let headerAt = -1;
    let cols: Partial<Record<Field, number>> = {};
    for (let i = 0; i < Math.min(grid.length, 8); i++) {
        const found = new Map<Field, { idx: number; score: number }>();
        grid[i].forEach((cell, idx) => {
            const f = fieldOf(cell);
            if (!f) return;
            const cur = found.get(f.field);
            if (!cur || f.score > cur.score) found.set(f.field, { idx, score: f.score });
        });
        // duas colunas no mesmo lugar? fica a de maior pontuação
        const used = new Set<number>();
        const chosen: Partial<Record<Field, number>> = {};
        [...found.entries()].sort((a, b) => b[1].score - a[1].score).forEach(([field, { idx }]) => {
            if (!used.has(idx)) { chosen[field] = idx; used.add(idx); }
        });
        if (chosen.name !== undefined && (Object.keys(chosen).length >= 2 || grid.length === 1 || i + 1 < grid.length)) {
            headerAt = i;
            cols = chosen;
            break;
        }
    }

    let body = grid;
    if (headerAt >= 0) {
        body = grid.slice(headerAt + 1);
    } else {
        // 2) sem cabeçalho: nome = coluna com mais texto; preço = coluna com mais números
        const width = Math.max(...grid.map((r) => r.length));
        const textScore = Array.from({ length: width }, (_, c) => grid.filter((r) => hasLetters(r[c]) && !isNumeric(r[c])).length);
        const numScore = Array.from({ length: width }, (_, c) => grid.filter((r) => isNumeric(r[c])).length);
        const nameCol = textScore.indexOf(Math.max(...textScore));
        cols.name = nameCol;
        const priceCol = numScore.map((n, c) => ({ n, c })).filter((x) => x.c !== nameCol && x.n > 0).sort((a, b) => b.n - a.n)[0];
        if (priceCol) cols.price = priceCol.c;
        const catCol = textScore.map((n, c) => ({ n, c })).filter((x) => x.c !== nameCol && x.n > grid.length * 0.5)[0];
        if (catCol) cols.category = catCol.c;
    }

    const out: ImportRow[] = [];
    for (const r of body) {
        const name = cleanProductName(r[cols.name!] || '');
        if (!name || !hasLetters(name)) continue;
        if (fieldOf(name)?.field === 'name' && norm(name).split(' ').length === 1 && body.length > 1 && fieldOf(name)!.score === 3) continue; // linha de cabeçalho repetida
        const row: ImportRow = { name };
        const get = (f: Field) => (cols[f] !== undefined ? r[cols[f]!] : '') || '';
        const category = get('category').trim();
        if (category) row.category = cleanProductName(category);
        const price = parsePrice(get('price'));
        if (price !== null) row.price = price;
        const cost = parsePrice(get('cost'));
        if (cost !== null) row.cost = cost;
        const unit = get('unit').trim();
        if (unit && unit.length <= 12) row.unit = unit;
        const code = get('code').trim();
        if (code) row.code = code;
        const image = get('image').trim();
        if (/^https?:\/\//i.test(image)) row.imageUrl = image;
        out.push(row);
    }
    return out;
}

// ---------------------------------------------------------------- texto colado

const splitLine = (line: string, d: string) => {
    if (d === '|') {
        const cells = line.split('|').map((c) => c.trim());
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        return cells;
    }
    return line.split(d).map((c) => c.trim());
};

const CATEGORY_LINE = /^(?:cat(?:egoria)?|fam[ií]lia|grupo|sec[cç][aã]o)\s*[:\-–]\s*(.+)$/i;
const SKIP_LINE = /^(?:revenda|custo|des\.?|desc\.?|desconto|iva|total|subtotal|p[aá]g(?:ina)?\b|page\b|n[º°o]?\.?\s*(?:de\s*)?(?:produ?c?tos|artigos)|pre[cç]o\s*[:\-]?\s*$)/i;
const CURRENCY = /\b(?:mts?|mzn|meticais|metical|usd|eur|kz|aoa|zar)\b\.?|[€$]/i;
const PRICE_TAIL = new RegExp(String.raw`^(.*?\S)(?:\s*[|;:=—–\t]+\s*|\s*-\s+|\s*\.{2,}\s*|\s{2,})((?:\d{1,3}(?:[. ]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:mts?|mzn|meticais|metical|usd|eur|kz|aoa|zar|[€$])?\.?\s*(?:/\s*\S+)?$`, 'i');
const PRICE_TAIL_CURRENCY = new RegExp(String.raw`^(.*?\S)\s+((?:\d{1,3}(?:[. ]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:mts?|mzn|meticais|metical|usd|eur|kz|aoa|zar|[€$])\.?\s*$`, 'i');
const PRICE_HEAD_CURRENCY = new RegExp(String.raw`^((?:\d{1,3}(?:[. ]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:mts?|mzn|meticais|metical|usd|eur|kz|aoa|zar|[€$])\s+(.*\S)$`, 'i');

/** Texto colado (de Excel, WhatsApp, PDF, uma lista, ou a resposta de uma IA) → produtos. */
export function parseText(input: string): ImportRow[] {
    const lines = input.replace(/\r/g, '').split('\n').map((l) => l.replace(/^\s*(?:[-*•·▪►]|\d{1,3}[.)])\s+/, '').replace(/\*\*|`/g, '').trimEnd()).filter((l) => l.trim());
    if (!lines.length) return [];

    // tabela com separador (tab, |, ;)? ignora linhas "---" de markdown
    const tableLines = lines.filter((l) => !/^\s*\|?[\s:|-]*-{2,}[\s:|-]*\|?\s*$/.test(l));
    for (const d of ['\t', '|', ';']) {
        const withD = tableLines.filter((l) => l.includes(d));
        if (withD.length >= Math.max(1, Math.ceil(tableLines.length * 0.7)) && (withD.length > 1 || tableLines.length === 1)) {
            const rows = rowsFromTable(tableLines.filter((l) => l.includes(d)).map((l) => splitLine(l, d)));
            if (rows.length) return rows;
        }
    }
    // vírgulas só se a 1.ª linha for claramente um cabeçalho (nome, preço…) — senão "1.234,50" confundia
    if (lines[0].includes(',')) {
        const head = lines[0].split(',').map((c) => c.trim());
        if (head.length >= 2 && head.filter((c) => fieldOf(c)).length >= 2) {
            const rows = rowsFromTable(lines.map((l) => l.split(',').map((c) => c.trim())));
            if (rows.length) return rows;
        }
    }

    // texto livre: "Nome ... preço", com títulos de categoria pelo meio
    const out: ImportRow[] = [];
    let category: string | undefined;
    const itemOf = (line: string): { name: string; price: number | null } | null => {
        let m = line.match(PRICE_TAIL_CURRENCY) || line.match(PRICE_TAIL);
        if (m) return { name: m[1], price: parsePrice(m[2]) };
        m = line.match(PRICE_HEAD_CURRENCY);
        if (m) return { name: m[2], price: parsePrice(m[1]) };
        return null;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (SKIP_LINE.test(line)) continue;
        const cat = line.match(CATEGORY_LINE);
        if (cat) { category = cleanProductName(cat[1].replace(/\s*(?:des\.?|desc\.?)\s*\d+\s*%.*$/i, '').replace(/\s*n[º°o]?\s*produtos.*$/i, '')); continue; }
        if (/^[A-Z0-9 ÁÀÂÃÉÊÍÓÔÕÚÇ&/-]{3,40}:?$/.test(line) && /\p{L}{3}/u.test(line) && !/\d{3,}/.test(line)) {
            // TÍTULO EM MAIÚSCULAS sem preço: categoria só se logo a seguir vier um produto com preço
            const next = lines.slice(i + 1).find((l) => !SKIP_LINE.test(l.trim()));
            if (line.endsWith(':') || (next && itemOf(next.trim()))) { category = cleanProductName(line.replace(/:$/, '').toLowerCase()); continue; }
        }
        if (/^[\p{L}][\p{L} ]{2,40}:$/u.test(line)) { category = cleanProductName(line.slice(0, -1)); continue; }
        if (/^[A-Z]{1,4}\d{1,4}$/.test(line)) continue; // código solto (BJ01)
        const item = itemOf(line);
        const name = cleanProductName((item ? item.name : line).replace(/[\s|;:=—–.·_-]+$/, ''));
        if (!name || !hasLetters(name) || isNumeric(name)) continue;
        const row: ImportRow = { name };
        if (category) row.category = category;
        if (item && item.price !== null) row.price = item.price;
        out.push(row);
    }
    return out;
}

// ---------------------------------------------------------------- comparar com o catálogo

export type PlannedRow = {
    row: ImportRow;
    /** new = ainda não existe · exists = já está no catálogo · similar = parecido com um que existe · duplicate = repetido na própria lista */
    status: 'new' | 'exists' | 'similar' | 'duplicate';
    match?: { id?: string; name: string; price?: number };
    include: boolean;
};

export function planImport(rows: ImportRow[], catalog: { id?: string; name: string; price?: number; category?: string; unit?: string }[]): PlannedRow[] {
    const seen = new Map<string, ImportRow>();
    const out: PlannedRow[] = [];
    for (const row of rows) {
        const key = nameKey(row.name);
        const prev = seen.get(key);
        if (prev) {
            if (prev.price === undefined && row.price !== undefined) prev.price = row.price;
            out.push({ row, status: 'duplicate', include: false });
            continue;
        }
        seen.set(key, row);
        const exact = catalog.find((c) => nameKey(c.name) === key);
        if (exact) { out.push({ row, status: 'exists', match: { id: exact.id, name: exact.name, price: exact.price }, include: false }); continue; }
        const similar = findNameMatches(row.name, { inventory: [], catalog }, { minScore: 0.8, limit: 1 })[0];
        if (similar) { out.push({ row, status: 'similar', match: { name: similar.name, price: similar.price }, include: true }); continue; }
        out.push({ row, status: 'new', include: true });
    }
    return out;
}

// ---------------------------------------------------------------- PDF / fotografia (IA do próprio utilizador)

/** Instrução para dar à IA (Gemini, Claude, ChatGPT…) junto com o PDF ou a fotografia; a resposta cola-se de volta. */
export function buildImportPrompt(): string {
    return [
        'Vou enviar um catálogo ou lista de produtos (PDF, fotografia, folha ou tabela).',
        'Extrai TODOS os produtos de TODAS as páginas, sem saltar nenhum.',
        '',
        'Responde APENAS com uma linha por produto, neste formato exacto (a primeira linha é o cabeçalho):',
        'Nome | Categoria | Preço | Unidade | Código',
        '',
        'Regras:',
        '- Preço: só o número, sem moeda, com vírgula nos decimais. É o preço de venda ao público (normalmente o mais alto): ignora preços de revenda, custo, descontos e IVA. Se não houver preço, deixa vazio.',
        '- Categoria: o título da secção em que o produto aparece (ex.: "Banco de concreto"). Vazio se não houver.',
        '- Unidade (un, m², kg, saco…) e Código (referência, ex.: BJ01): só se aparecerem; senão deixa vazio.',
        '- Não inventes, não resumas, não juntes produtos. Sem títulos, totais, explicações nem blocos de código.',
    ].join('\n');
}
