// Procura "por aproximação" para o ditado: o reconhecimento de voz erra letras e inventa palavras parecidas
// ("afiador" → "apontador", "pavê" → "pave", "bandoleta" → "bandoleira"). Aqui compara-se como as palavras SOAM
// (chave fonética do português) e devolve-se os produtos mais parecidos, com uma nota de 0 a 1, para a pessoa confirmar.
import type { Product } from '@/lib/types';
import { normalizeString } from '@/lib/utils';
import { pickVoiceMatch } from '@/lib/quick-stock';
import type { VoiceItem } from '@/lib/voice-parse';

const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'um', 'uma', 'para', 'com', 'em', 'no', 'na', 'tipo']);

/** Como a palavra soa: iguala c/ç/ss/s/z, ch/x, lh, nh, qu/c/k, h mudo, g/j, ph/f, ou/o… e junta letras repetidas. */
export function phonetic(word: string): string {
    let w = word.toLowerCase().replace(/ç/g, 's');
    w = normalizeString(w).replace(/[^a-z0-9.]/g, '');
    if (/\d/.test(w)) return w; // números ficam como estão
    w = w
        .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/sh|ch/g, 'x')
        .replace(/lh/g, 'li').replace(/nh/g, 'ni')
        .replace(/qu(?=[ei])/g, 'k').replace(/gu(?=[ei])/g, 'g').replace(/qu/g, 'ku')
        .replace(/c(?=[ei])/g, 's').replace(/c/g, 'k')
        .replace(/g(?=[ei])/g, 'j')
        .replace(/w/g, 'v').replace(/y/g, 'i').replace(/z/g, 's')
        .replace(/^h/, '').replace(/h/g, '')
        .replace(/ou/g, 'o').replace(/ao$|am$/g, 'au')
        .replace(/(.)\1+/g, '$1');
    // m/n antes de consoante só nasalam a vogal: "bandoleta" ≈ "badoleta"
    w = w.replace(/[mn](?=[bcdfgjklmnpqrstvxz])/g, '');
    return w;
}

const lev = (a: string, b: string): number => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
};

/** Singular aproximado, para "afiadores" ≈ "afiador". */
const singular = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

/** 0..1: quão parecidas soam duas palavras. */
export function wordSimilarity(a: string, b: string): number {
    const na = normalizeString(a), nb = normalizeString(b);
    const aNum = /\d/.test(na), bNum = /\d/.test(nb);
    if (aNum || bNum) return na === nb ? 1 : 0; // "15" nunca se parece com "20"
    const ka = phonetic(singular(na)), kb = phonetic(singular(nb));
    if (!ka || !kb) return 0;
    if (ka === kb) return 1;
    const sim = 1 - lev(ka, kb) / Math.max(ka.length, kb.length);
    const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
    // um começa pelo outro ("band" / "bandoleta"): fala cortada ou palavra mais longa
    if (short.length >= 4 && long.startsWith(short)) return Math.max(sim, 0.82);
    return sim;
}

export type Scored<T = Product> = { product: T; score: number };

/** Produtos mais parecidos com o que se disse, do mais ao menos parecido. */
export function approxProducts<T extends { name: string }>(products: T[], term: string, limit = 5): Scored<T>[] {
    const all = normalizeString(term).replace(/[^a-z0-9.\s]/g, ' ').split(/\s+/).filter(Boolean);
    const qt = all.filter((w) => !STOP.has(w));
    const tokens = qt.length ? qt : all;
    if (!tokens.length) return [];
    const out: Scored<T>[] = [];
    for (const product of products) {
        const words = normalizeString(product.name).replace(/[^a-z0-9.\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
        if (!words.length) continue;
        let sum = 0, weight = 0, matched = 0;
        for (const t of tokens) {
            const best = Math.max(...words.map((w) => wordSimilarity(t, w)));
            const wgt = /\d/.test(t) ? 1 : Math.max(1, t.length / 3);
            sum += best * wgt; weight += wgt;
            if (best >= 0.7) matched++;
        }
        // nota = média das palavras ditas; palavras do nome que ninguém disse descontam um pouco
        const coverage = 0.88 + 0.12 * Math.min(1, matched / words.length);
        out.push({ product, score: (sum / weight) * coverage });
    }
    return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

export type VoiceResolution =
    | { kind: 'hit'; product: Product }
    /** Não é certo: mostrar as hipóteses e pedir confirmação. */
    | { kind: 'confirm'; options: Product[] }
    | { kind: 'none' };

/** Abaixo disto não vale a pena sugerir: é outra coisa. */
export const MIN_SUGGEST = 0.5;

/**
 * O que fazer com um item ditado. Certo (um só produto bate) → adiciona. Parecido mas não certo → confirma.
 * Nada parecido → não encontrado. Se o texto sem a unidade ("pavê") não der nada, tenta o completo ("10 sacos de cimento").
 */
export function resolveVoice(products: Product[], item: VoiceItem): VoiceResolution {
    const terms = item.full && item.full !== item.term ? [item.term, item.full] : [item.term];
    for (const term of terms) {
        // só correspondências certas (sem tolerância a erros): o resto passa pela aproximação e pede confirmação
        const { hit, ambiguous } = pickVoiceMatch(products, term, false);
        if (hit) return { kind: 'hit', product: hit };
        if (ambiguous.length) return { kind: 'confirm', options: ambiguous };
    }
    for (const term of terms) {
        const near = approxProducts(products, term, 4).filter((s) => s.score >= MIN_SUGGEST);
        if (near.length) return { kind: 'confirm', options: near.map((s) => s.product) };
    }
    return { kind: 'none' };
}

