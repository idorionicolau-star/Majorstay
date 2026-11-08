// Interpreta o que a pessoa disse ("dez sacos de cimento e duas latas de tinta branca") em itens
// { qty, term }. Só regras — sem IA, sem internet. O ditado vem do navegador; isto só arruma o texto.

export type VoiceItem = {
  qty: number | null;
  term: string;
  /** Se se tirou uma palavra de medida do nome ("15 metros de pavê" → "pave"), o texto completo, para tentar se o resto não existir. */
  full?: string;
};

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const UNITS_WORDS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezasseis: 16, dezesseis: 16, dezassete: 17,
  dezessete: 17, dezoito: 18, dezanove: 19, dezenove: 19,
};
const TENS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const HUNDREDS: Record<string, number> = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 };

const isNumWord = (w: string) => w in UNITS_WORDS || w in TENS || w in HUNDREDS || w === 'mil' || w === 'meio' || w === 'meia';

const GLUE = new Set(['de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'o', 'a', 'os', 'as', 'quero', 'preciso', 'poe', 'por', 'favor', 'adiciona', 'adicionar', 'junta', 'juntar', 'vende', 'vender', 'registar', 'regista', 'entrada', 'saida']);

/** Lê um número a partir da posição i. Devolve valor e quantas palavras consumiu. */
function readNumber(words: string[], i: number): { value: number; used: number } | null {
  const w = words[i];
  if (/^\d+([.,]\d+)?$/.test(w)) return { value: Number(w.replace(',', '.')), used: 1 };
  if (!isNumWord(w)) return null;
  let total = 0;
  let current = 0;
  let used = 0;
  let j = i;
  let any = false;
  while (j < words.length) {
    const t = words[j];
    if (t === 'e' && any && j + 1 < words.length && (isNumWord(words[j + 1]) && words[j + 1] !== 'mil')) { j++; used++; continue; }
    if (t === 'meio' || t === 'meia') { current += 0.5; any = true; used++; j++; continue; }
    if (t in HUNDREDS) { current += HUNDREDS[t]; }
    else if (t in TENS) { current += TENS[t]; }
    else if (t in UNITS_WORDS) { current += UNITS_WORDS[t]; }
    else if (t === 'mil') { total += (current || 1) * 1000; current = 0; }
    else break;
    any = true; used++; j++;
  }
  // "e" final pendurado ("dez e") não faz parte do número
  if (words[i + used - 1] === 'e') used--;
  return any ? { value: total + current, used } : null;
}

/** "15 unidades", "32 metros de …": o número seguido destas palavras é a quantidade. */
const QTY_UNITS = new Set([
  'unidade', 'unidades', 'un', 'uni', 'peca', 'pecas', 'metro', 'metros', 'm', 'm2', 'm3', 'saco', 'sacos', 'caixa', 'caixas', 'lata', 'latas',
  'kg', 'kgs', 'quilo', 'quilos', 'quilograma', 'quilogramas', 'litro', 'litros', 'l', 'rolo', 'rolos', 'pacote', 'pacotes', 'par', 'pares',
  'folha', 'folhas', 'barra', 'barras', 'fardo', 'fardos', 'palete', 'paletes', 'duzia', 'duzias', 'garrafa', 'garrafas', 'balde', 'baldes',
  'tubo', 'tubos', 'conjunto', 'conjuntos', 'cj', 'jogo', 'jogos', 'embalagem', 'embalagens', 'carga', 'cargas', 'tonelada', 'toneladas',
]);
/** Medidas de tamanho: "15 mm" é parte do nome do produto, não quantidade. */
const SIZE_WORDS = new Set(['mm', 'cm', 'milimetro', 'milimetros', 'centimetro', 'centimetros', 'polegada', 'polegadas', 'pol', 'x', 'por']);

const MARKS = new Set(['x', '×', 'xis', 'vezes']);
const isMark = (w: string) => MARKS.has(w);
const norm = (s: string) => strip(s).replace(/(\d)\s*[x×]\s*(\d)/g, '$1x$2').replace(/[^a-z0-9.x]+/g, ' ').trim();

type Tok = { kind: 'num'; value: number } | { kind: 'word'; w: string } | { kind: 'mark' } | { kind: 'sep' };

/**
 * A QUANTIDADE SÓ CONTA COM "x": "cimento x 20", "x 20 cimento", "20 x cimento", "cimento x20".
 * Qualquer outro número é parte do nome (tamanho/medida): "bloco quinze" → "bloco 15", "passadeira oito pistões".
 *
 *   "cimento x vinte e areia x 5"      → [{20,'cimento'},{5,'areia'}]
 *   "bloco quinze x duzentos"          → [{200,'bloco 15'}]
 *   "bloco 15 x 40 x 200"              → [{200,'bloco 15 x 40'}]      (a última é a quantidade)
 *   "bloco 15 x 40"                    → 40 × 'bloco 15' (a menos que "Bloco 15x40" seja um produto: então é a medida)
 *   "dez sacos de cimento"             → [{null,'10 sacos de cimento'}]  (sem x não há quantidade)
 */
export function parseVoice(transcript: string, productNames: string[] = []): VoiceItem[] {
  const text = strip(transcript)
    .replace(/(\d)[.,](\d)/g, '$1§$2') // decimais (2,5 / 32.5) não se partem
    .replace(/[.,;!?]/g, (m) => (m === ',' || m === ';' ? ' | ' : ' '))
    .replace(/§/g, '.')
    // "x20" / "20x" ditados juntos
    .replace(/\bx\s*(\d+(?:[.,]\d+)?)\b/g, ' x $1 ')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*x\b/g, ' $1 x ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];
  const words = text.split(' ');

  const toks: Tok[] = [];
  for (let i = 0; i < words.length; ) {
    const w = words[i];
    if (w === '|' || w === 'mais' || w === 'depois' || w === 'tambem') { toks.push({ kind: 'sep' }); i++; continue; }
    if (isMark(w)) { toks.push({ kind: 'mark' }); i++; continue; }
    // "uma lata de tinta": um/uma são artigos; só são número ao lado de um "x" ("x um", "uma x")
    if ((w === 'um' || w === 'uma') && !isMark(words[i - 1] || '') && !isMark(words[i + 1] || '')) { toks.push({ kind: 'word', w }); i++; continue; }
    const n = readNumber(words, i);
    if (n) { toks.push({ kind: 'num', value: n.value }); i += n.used; continue; }
    toks.push({ kind: 'word', w }); i++;
  }

  // Itens: vírgula/"mais"/"depois" separam; e um "e" logo a seguir a uma quantidade ("x 20 e …") também.
  const groups: Tok[][] = [[]];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const cur = groups[groups.length - 1];
    if (t.kind === 'sep') { groups.push([]); continue; }
    if (t.kind === 'word' && t.w === 'e' && cur.length >= 2 && cur[cur.length - 1].kind === 'num' && cur[cur.length - 2].kind === 'mark' && i + 1 < toks.length) {
      groups.push([]);
      continue;
    }
    // "… 15 unidades e pavê 32 metros": um "e" logo a seguir a número + unidade também separa artigos
    if (t.kind === 'word' && t.w === 'e' && cur.length >= 2 && i + 1 < toks.length) {
      const a = cur[cur.length - 1], b = cur[cur.length - 2];
      if (a.kind === 'word' && QTY_UNITS.has(a.w) && b.kind === 'num') { groups.push([]); continue; }
    }
    cur.push(t);
  }

  const known = productNames.map(norm);
  const isNameStart = (t: string) => !!t && known.some((n) => (' ' + n).includes(' ' + t));

  const items: VoiceItem[] = [];
  for (const g of groups) {
    if (!g.length) continue;
    let qty: number | null = null;
    let body = g;

    const marks = g.map((t, i) => (t.kind === 'mark' ? i : -1)).filter((i) => i >= 0);
    const last = g.length - 1;
    // "… x 20" no fim
    const trailing = last >= 1 && g[last].kind === 'num' && g[last - 1].kind === 'mark';
    // "20 x …" ou "x 20 …" no princípio
    const leadingNumMark = g.length >= 3 && g[0].kind === 'num' && g[1].kind === 'mark';
    const leadingMarkNum = g.length >= 3 && g[0].kind === 'mark' && g[1].kind === 'num';

    if (trailing) {
      const before = g.slice(0, last - 1);
      // "bloco 15 x 40": com espaços o ditado escreve igual uma medida e uma quantidade. O "x" é a marca da
      // quantidade, por isso conta como tal — a não ser que "bloco 15x40" seja um produto que existe.
      // (Uma medida ditada de outra forma, "15 por 40" ou "15x40" colado, nunca é confundida.)
      const measureLike = before.length > 0 && before[before.length - 1].kind === 'num' && marks.length === 1;
      const asName = measureLike && isNameStart(norm(tokensToText(g)));
      if (!asName) { qty = (g[last] as { kind: 'num'; value: number }).value; body = before; }
    } else if (leadingNumMark) {
      qty = (g[0] as { kind: 'num'; value: number }).value;
      body = g.slice(2);
    } else if (leadingMarkNum) {
      qty = (g[1] as { kind: 'num'; value: number }).value;
      body = g.slice(2);
    }
    let full: string | undefined;
    if (qty === null) {
      const nat = naturalQty(g, isNameStart, norm);
      if (nat) { qty = nat.qty; body = nat.rest; full = clean(g); }
    }
    const term = clean(body);
    if (term) { items.push(full && full !== term ? { qty, term, full } : { qty, term }); continue; }
    // "afiador de plástico, 15 unidades": a quantidade veio num grupo à parte → vai para o artigo anterior
    const lone = naturalQty(g, () => false, norm, true);
    const prev = items[items.length - 1];
    if (lone && prev && prev.qty === null) prev.qty = lone.qty;
  }
  return items;
}

function tokensToText(tokens: Tok[]): string {
  return tokens.map((t) => (t.kind === 'num' ? String(t.value) : t.kind === 'word' ? t.w : t.kind === 'mark' ? 'x' : '')).join(' ');
}

function clean(tokens: Tok[]): string {
  const out: string[] = [];
  let leading = true;
  for (const t of tokens) {
    if (t.kind === 'num') { out.push(String(t.value)); leading = false; continue; }
    if (t.kind === 'mark') { out.push('x'); leading = false; continue; }
    if (t.kind !== 'word') continue;
    if (leading && GLUE.has(t.w)) continue;
    if (t.w === 'por') { out.push('x'); leading = false; continue; }
    leading = false;
    out.push(t.w);
  }
  while (out.length && GLUE.has(out[out.length - 1]) && out.length > 1) out.pop();
  return out.join(' ').trim();
}

/**
 * Quantidade dita à vontade, sem "x":
 *   "15 unidades de afiador"  → 15, resto "afiador"       "pavê 32 metros"        → 32, resto "pave"
 *   "15 afiadores de plástico" → 15, resto "afiadores de plástico"   (número à cabeça, seguido de palavras)
 * Não conta: medidas ("15 mm"), nomes de produtos que começam pelo número, e números no meio do nome sem unidade.
 * `loneGroup`: o grupo é só "15 unidades" (ou "15") — para ligar ao artigo anterior.
 */
function naturalQty(g: Tok[], isNameStart: (t: string) => boolean, norm: (s: string) => string, loneGroup = false): { qty: number; rest: Tok[] } | null {
  const w = (t?: Tok) => (t && t.kind === 'word' ? t.w : '');
  for (let i = 0; i < g.length; i++) {
    const t = g[i];
    if (t.kind !== 'num') continue;
    let j = i + 1;
    const unit = w(g[j]);
    if (QTY_UNITS.has(unit)) {
      j++;
      if (/^quadrad[oa]s?$/.test(w(g[j]))) j++; // "metros quadrados"
      // "15 metros de pavê": o "de" que liga a unidade ao produto sai
      const rest = [...g.slice(0, i), ...g.slice(j)];
      if (['de', 'do', 'da', 'dos', 'das'].includes(w(rest[i]))) rest.splice(i, 1);
      return { qty: t.value, rest };
    }
    if (loneGroup) return g.length === 1 ? { qty: t.value, rest: [] } : null;
    // número à cabeça seguido de palavras: "15 afiadores de plástico"
    if (i === 0 && g.length > 1 && g[1].kind === 'word' && !SIZE_WORDS.has(w(g[1]))) {
      if (isNameStart(norm(tokensToText(g)))) return null; // "15 Colunas" é um produto
      return { qty: t.value, rest: g.slice(1) };
    }
  }
  return null;
}
