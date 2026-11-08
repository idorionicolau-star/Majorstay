// Sugestão de categoria sem IA externa (funciona offline e de borla).
// 1) produtos parecidos que já têm categoria  2) palavras-chave de materiais de construção
// 3) casar com uma categoria existente (singular/plural, sem acentos).

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const words = (s: string) => strip(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !/^\d+([.,]\d+)?$/.test(w));
const stem = (w: string) => w.replace(/(es|s)$/, '');

// palavra-chave (sem acentos) → categoria canónica
const KEYWORDS: [string[], string][] = [
    [['bloco', 'blocos', 'tijolo', 'tijolos', 'abobadilha', 'cunhal'], 'Blocos'],
    [['cimento', 'cal', 'argamassa', 'reboco', 'cola', 'betumite', 'betonilha'], 'Cimento'],
    [['areia', 'pedra', 'brita', 'burgau', 'saibro', 'gravilha'], 'Inertes'],
    [['vara', 'varao', 'varoes', 'ferro', 'aco', 'arame', 'malha', 'estribo', 'treliça', 'trelica', 'cantoneira', 'perfil'], 'Ferro'],
    [['pave', 'paver', 'lancil', 'lancis', 'guia', 'pavimento', 'mosaico', 'ladrilho', 'azulejo', 'piso', 'lajeta'], 'Pavimentos'],
    [['viga', 'vigas', 'laje', 'lajes', 'pilar', 'pilares', 'verga', 'vergas', 'lintel', 'cofragem', 'pre-fabricado', 'prefabricado'], 'Pré-fabricados'],
    [['telha', 'telhas', 'chapa', 'chapas', 'zinco', 'caibro', 'ripa', 'cumeeira', 'rufo', 'calha'], 'Coberturas'],
    [['madeira', 'tabua', 'tabuas', 'prancha', 'barrote', 'contraplacado', 'mdf', 'porta', 'portas', 'janela', 'janelas', 'aro', 'batente'], 'Madeiras e Portas'],
    [['tubo', 'tubos', 'cano', 'canos', 'joelho', 'torneira', 'sanita', 'lavatorio', 'pia', 'sifao', 'valvula', 'manilha', 'fossa', 'pvc', 'caixa de visita'], 'Canalização'],
    [['tinta', 'tintas', 'verniz', 'diluente', 'pincel', 'rolo', 'massa', 'primario', 'esmalte'], 'Tintas'],
    [['prego', 'pregos', 'parafuso', 'parafusos', 'bucha', 'fechadura', 'dobradica', 'cadeado', 'ferrolho', 'puxador', 'grade', 'grades', 'cerca', 'rede', 'arame farpado'], 'Ferragens'],
    [['cabo', 'cabos', 'fio', 'fios', 'tomada', 'interruptor', 'lampada', 'disjuntor', 'quadro', 'candeeiro', 'eletrico', 'electrico'], 'Electricidade'],
    [['enxada', 'pa', 'picareta', 'martelo', 'serra', 'trolha', 'colher', 'nivel', 'fita metrica', 'carrinho', 'carro de mao', 'balde', 'ferramenta', 'ferramentas', 'luva', 'luvas', 'capacete', 'bota', 'botas'], 'Ferramentas'],
    [['passadeira', 'passadeiras', 'vaso', 'vasos', 'jardim', 'banco', 'poste', 'postes', 'decoracao', 'estatua', 'fonte', 'muro'], 'Jardim e Decoração'],
    [['carvao', 'lenha', 'gas', 'botija'], 'Combustíveis'],
];

const singular = (w: string) => stem(strip(w));

/** Casa o nome sugerido com uma categoria já existente (ignora acentos, maiúsculas, plural). */
export function matchExistingCategory(name: string, existing: string[]): string | null {
    const target = singular(name);
    return existing.find((c) => singular(c) === target) || null;
}

export type CategorizeSample = { name?: string; category?: string };

/**
 * @returns { category, source } ou null quando não há nenhuma pista.
 * `source`: 'similar' (produto parecido), 'keyword' (palavra-chave) — usado para decidir se vale perguntar ao Gemini.
 */
export function categorizeLocally(
    productName: string,
    existingCategories: string[],
    products: CategorizeSample[] = [],
): { category: string; source: 'similar' | 'keyword' } | null {
    const w = words(productName).map(stem);
    if (!w.length) return null;

    // 1) produtos parecidos: pontua pelas palavras em comum, o primeiro termo (o "tipo") pesa mais
    const score = new Map<string, number>();
    for (const p of products) {
        const cat = (p.category || '').trim();
        if (!p.name || !cat || strip(cat) === 'sem categoria') continue;
        const pw = words(p.name).map(stem);
        let s = 0;
        w.forEach((x, i) => { if (pw.includes(x)) s += i === 0 ? 3 : 1; });
        if (s > 0) score.set(cat, (score.get(cat) || 0) + s);
    }
    const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 3) return { category: best[0], source: 'similar' };

    // 2) palavras-chave
    for (const [keys, canonical] of KEYWORDS) {
        if (keys.some((k) => w.includes(stem(strip(k))) || strip(productName).includes(strip(k)) && k.length > 4)) {
            return { category: matchExistingCategory(canonical, existingCategories) || canonical, source: 'keyword' };
        }
    }

    // 3) uma palavra do nome coincide com o nome de uma categoria existente
    for (const c of existingCategories) {
        if (w.includes(singular(c))) return { category: c, source: 'similar' };
    }
    return null;
}
