// Temas de exportação dos documentos (PDF). Cada tema decide o aspecto; a cor de destaque é escolhida à parte.
export type RGB = [number, number, number];
export type DocThemeId =
    | 'classico' | 'moderno' | 'minimalista' | 'elegante' | 'corporativo' | 'vibrante'
    | 'onda' | 'onda-serena' | 'cartao' | 'cartao-coral' | 'moldura' | 'moldura-noite' | 'faixas' | 'faixas-verdes'
    | 'estudio' | 'estudio-grafite' | 'canto' | 'canto-dourado' | 'bolhas' | 'bolhas-ceu'
    | 'vidro' | 'cartaz' | 'atelier' | 'executivo' | 'mare';

/** Cabeçalhos com desenho próprio (ondas, cartão, moldura…): cada um decora também o rodapé e as páginas seguintes. */
export type DocDecor = 'wave' | 'card' | 'frame' | 'stripes' | 'hatch' | 'corner' | 'circles' | 'glass' | 'poster' | 'atelier' | 'ribbon' | 'swirl';

export type DocTheme = {
    id: DocThemeId;
    name: string;
    description: string;
    font: 'helvetica' | 'times';
    header: 'line' | 'band' | 'minimal' | 'centered' | 'sidebar' | 'block' | DocDecor;
    table: 'plain' | 'striped' | 'grid' | 'minimal' | 'filled';
    boxes: 'boxed' | 'plain' | 'bar';
    totals: 'line' | 'block';
    defaultAccent: RGB;
    /** segunda cor (ex.: o dourado da Moldura) */
    highlight?: RGB;
    /** coluna com o número da linha antes do artigo */
    numbered?: boolean;
};

/** Caminho em mm numa página A4: ponto inicial e passos, cada um recta [x, y] ou curva [c1x, c1y, c2x, c2y, x, y]. */
export type DecorPath = [[number, number], number[][]];
/** As ondas da "Maré" no topo (o rodapé usa-as espelhadas e mais baixas). Iguais no PDF e na pré-visualização. */
export const SWIRL_NAVY: DecorPath = [[0, 0], [[146, 0], [138, 8, 118, 24, 86, 30], [70, 33, 60, 38, 58, 44], [78, 40, 100, 41, 118, 44], [92, 52, 40, 66, 0, 88]]];
export const SWIRL_LIGHT: DecorPath = [[0, 0], [[210, 0], [210, 76], [190, 66, 160, 60, 130, 66], [100, 72, 70, 78, 40, 74], [25, 72, 10, 76, 0, 82]]];
/** Altura (fracção) da onda do rodapé da "Maré" em relação à do topo. */
export const SWIRL_FOOT = 0.55;

export const DECORS: DocDecor[] = ['wave', 'card', 'frame', 'stripes', 'hatch', 'corner', 'circles', 'glass', 'poster', 'atelier', 'ribbon', 'swirl'];
export const isDecor = (h: DocTheme['header']): h is DocDecor => (DECORS as string[]).includes(h);

export const DOC_THEMES: DocTheme[] = [
    { id: 'classico', name: 'Clássico', description: 'Sóbrio e familiar: linhas finas e caixas cinzentas.', font: 'helvetica', header: 'line', table: 'plain', boxes: 'boxed', totals: 'line', defaultAccent: [24, 24, 27] },
    { id: 'moderno', name: 'Moderno', description: 'Faixa de cor no topo, linhas alternadas e destaque no total.', font: 'helvetica', header: 'band', table: 'striped', boxes: 'bar', totals: 'block', defaultAccent: [37, 99, 235] },
    { id: 'minimalista', name: 'Minimalista', description: 'Muito espaço em branco, só o essencial.', font: 'helvetica', header: 'minimal', table: 'minimal', boxes: 'plain', totals: 'line', defaultAccent: [39, 39, 42] },
    { id: 'elegante', name: 'Elegante', description: 'Letra com serifa, cabeçalho centrado e dupla linha.', font: 'times', header: 'centered', table: 'grid', boxes: 'plain', totals: 'line', defaultAccent: [30, 58, 95] },
    { id: 'corporativo', name: 'Corporativo', description: 'Barra lateral de cor e tabela com cabeçalho preenchido.', font: 'helvetica', header: 'sidebar', table: 'filled', boxes: 'boxed', totals: 'block', defaultAccent: [4, 120, 87] },
    { id: 'vibrante', name: 'Vibrante', description: 'Bloco de cor com o título e total em destaque.', font: 'helvetica', header: 'block', table: 'filled', boxes: 'bar', totals: 'block', defaultAccent: [234, 88, 12] },
    { id: 'onda', name: 'Onda', description: 'Ondas de cor no topo e no rodapé, tabela com cabeçalho cheio.', font: 'helvetica', header: 'wave', table: 'filled', boxes: 'plain', totals: 'block', defaultAccent: [15, 52, 96] },
    { id: 'onda-serena', name: 'Onda Serena', description: 'As ondas, em turquesa e com letra serifada.', font: 'times', header: 'wave', table: 'minimal', boxes: 'plain', totals: 'line', defaultAccent: [13, 128, 128] },
    { id: 'cartao', name: 'Cartão', description: 'Topo de cor com o cliente e a tabela num cartão a flutuar.', font: 'helvetica', header: 'card', table: 'plain', boxes: 'boxed', totals: 'block', defaultAccent: [67, 97, 170] },
    { id: 'cartao-coral', name: 'Cartão Coral', description: 'O cartão, quente e alegre.', font: 'helvetica', header: 'card', table: 'striped', boxes: 'boxed', totals: 'block', defaultAccent: [225, 82, 70] },
    { id: 'moldura', name: 'Moldura', description: 'Página emoldurada a cor, total em destaque logo no topo.', font: 'helvetica', header: 'frame', table: 'plain', boxes: 'boxed', totals: 'line', defaultAccent: [63, 81, 181], highlight: [250, 204, 21] },
    { id: 'moldura-noite', name: 'Moldura Noite', description: 'A moldura em azul-noite e dourado.', font: 'times', header: 'frame', table: 'plain', boxes: 'boxed', totals: 'line', defaultAccent: [23, 32, 54], highlight: [212, 175, 55] },
    { id: 'faixas', name: 'Faixas', description: 'Faixas inclinadas em fundo escuro, ar de estúdio de design.', font: 'helvetica', header: 'stripes', table: 'plain', boxes: 'bar', totals: 'block', defaultAccent: [220, 38, 38] },
    { id: 'faixas-verdes', name: 'Faixas Verdes', description: 'As faixas, em verde.', font: 'helvetica', header: 'stripes', table: 'striped', boxes: 'bar', totals: 'block', defaultAccent: [22, 163, 74] },
    { id: 'estudio', name: 'Estúdio', description: 'Riscas finas na diagonal e total destacado ao lado do cliente.', font: 'helvetica', header: 'hatch', table: 'plain', boxes: 'plain', totals: 'line', defaultAccent: [49, 46, 129] },
    { id: 'estudio-grafite', name: 'Estúdio Grafite', description: 'O estúdio em grafite, com letra serifada.', font: 'times', header: 'hatch', table: 'plain', boxes: 'plain', totals: 'line', defaultAccent: [55, 65, 81] },
    { id: 'canto', name: 'Canto', description: 'Triângulos de cor nos cantos, título grande à esquerda.', font: 'helvetica', header: 'corner', table: 'filled', boxes: 'boxed', totals: 'block', defaultAccent: [109, 40, 217] },
    { id: 'canto-dourado', name: 'Canto Dourado', description: 'Os cantos em dourado, com letra serifada.', font: 'times', header: 'corner', table: 'grid', boxes: 'plain', totals: 'line', defaultAccent: [161, 98, 7] },
    { id: 'bolhas', name: 'Bolhas', description: 'Círculos de cor a sobrepor-se nos cantos. Leve e moderno.', font: 'helvetica', header: 'circles', table: 'striped', boxes: 'bar', totals: 'block', defaultAccent: [219, 39, 119] },
    { id: 'bolhas-ceu', name: 'Bolhas Céu', description: 'As bolhas em azul-céu.', font: 'helvetica', header: 'circles', table: 'filled', boxes: 'bar', totals: 'block', defaultAccent: [2, 132, 199] },
    { id: 'vidro', name: 'Vidro', description: 'Topo de cor arredondado e cabeçalho da tabela em vidro, linhas numeradas.', font: 'helvetica', header: 'glass', table: 'plain', boxes: 'boxed', totals: 'block', defaultAccent: [72, 94, 168], highlight: [255, 128, 150], numbered: true },
    { id: 'cartaz', name: 'Cartaz', description: 'Página toda de cor com uma folha branca, total grande em amarelo.', font: 'helvetica', header: 'poster', table: 'plain', boxes: 'plain', totals: 'line', defaultAccent: [67, 86, 170], highlight: [242, 201, 76], numbered: true },
    { id: 'atelier', name: 'Atelier', description: 'Fundo riscado, cliente e detalhes lado a lado, total a pagar em barra.', font: 'helvetica', header: 'atelier', table: 'plain', boxes: 'plain', totals: 'line', defaultAccent: [44, 42, 120] },
    { id: 'executivo', name: 'Executivo', description: 'Fitas vermelhas em fundo escuro, coluna de contactos e duas assinaturas.', font: 'helvetica', header: 'ribbon', table: 'plain', boxes: 'plain', totals: 'block', defaultAccent: [214, 31, 38], numbered: true },
    { id: 'mare', name: 'Maré', description: 'Ondas azul-marinho em dois cantos, linhas numeradas e contactos no fim.', font: 'helvetica', header: 'swirl', table: 'filled', boxes: 'plain', totals: 'line', defaultAccent: [17, 61, 99], numbered: true },
];

export const ACCENT_PRESETS: { name: string; rgb: RGB }[] = [
    { name: 'Grafite', rgb: [39, 39, 42] },
    { name: 'Azul', rgb: [37, 99, 235] },
    { name: 'Marinho', rgb: [30, 58, 95] },
    { name: 'Verde', rgb: [4, 120, 87] },
    { name: 'Turquesa', rgb: [13, 148, 136] },
    { name: 'Laranja', rgb: [234, 88, 12] },
    { name: 'Vermelho', rgb: [190, 18, 60] },
    { name: 'Roxo', rgb: [109, 40, 217] },
    { name: 'Dourado', rgb: [161, 98, 7] },
    { name: 'Rosa', rgb: [219, 39, 119] },
];

export const themeById = (id?: string): DocTheme => DOC_THEMES.find((t) => t.id === id) || DOC_THEMES[0];

export const hexToRgb = (hex?: string | null): RGB | null => {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

/** Mistura a cor com branco: t=0 é a cor, t=1 é branco. Serve para fundos suaves. */
export const tint = (c: RGB, t: number): RGB => c.map((v) => Math.round(v + (255 - v) * t)) as RGB;

/** Texto legível sobre a cor (branco ou quase preto). */
export const readableOn = (c: RGB): RGB => ((c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 150 ? [24, 24, 27] : [255, 255, 255]);
