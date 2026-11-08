// "Foto de estúdio" sem IA e sem internet: separa o produto do fundo com processamento de imagem clássico e põe-no
// num fundo branco. Puro (só números), para correr no telemóvel e ser testado.
//
// Como funciona (parecido com o GrabCut, mas leve):
//  1. Cores em Lab (como o olho vê). O fundo aprende-se nas bordas da foto; o produto, no centro (é para onde se aponta).
//  2. Cada cor do fundo/produto é resumida em grupos (k-means). Cada ponto ganha uma probabilidade de ser produto,
//     conforme está mais perto dos grupos do produto ou dos do fundo, mais um pouco por estar perto do centro.
//  3. Essa probabilidade espalha-se pelos vizinhos MAS pára nos contornos (onde a cor muda de repente): assim um fundo
//     com várias cores, sombras ou objetos fica de fora, e o produto inteiro fica dentro.
//  4. Repete-se com as cores aprendidas da primeira volta (fica mais certo). Nessa volta, uma zona fechada por contornos
//     que já é quase toda produto passa a ser produto inteira (ex.: o fundo do frasco, mais escuro, na sombra).
//  5. Limpa-se o resultado (buracos, migalhas, só o objeto principal), tiram-se os "apêndices" finos que vão dar à borda
//     da foto (os dedos da mão que segura o produto) e alisam-se os contornos.

export type Pixels = { width: number; height: number; data: Uint8ClampedArray | number[] };

const EPS = 1e-6;

/** RGB (0–255) → Lab. */
function toLab(r: number, g: number, b: number): [number, number, number] {
    const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const R = lin(r), G = lin(g), B = lin(b);
    const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** k-means simples e determinístico (sem aleatório: a mesma foto dá sempre o mesmo resultado). */
export function kmeans(points: Float32Array, dims: number, k: number, iters = 8): Float32Array {
    const n = Math.floor(points.length / dims);
    const kk = Math.max(1, Math.min(k, n));
    const centers = new Float32Array(kk * dims);
    for (let c = 0; c < kk; c++) {
        const idx = Math.floor(((c + 0.5) * n) / kk);
        for (let d = 0; d < dims; d++) centers[c * dims + d] = points[idx * dims + d];
    }
    const sums = new Float64Array(kk * dims);
    const counts = new Uint32Array(kk);
    for (let it = 0; it < iters; it++) {
        sums.fill(0); counts.fill(0);
        for (let i = 0; i < n; i++) {
            let best = 0, bd = Infinity;
            for (let c = 0; c < kk; c++) {
                let dist = 0;
                for (let d = 0; d < dims; d++) { const v = points[i * dims + d] - centers[c * dims + d]; dist += v * v; }
                if (dist < bd) { bd = dist; best = c; }
            }
            counts[best]++;
            for (let d = 0; d < dims; d++) sums[best * dims + d] += points[i * dims + d];
        }
        for (let c = 0; c < kk; c++) if (counts[c]) for (let d = 0; d < dims; d++) centers[c * dims + d] = sums[c * dims + d] / counts[c];
    }
    return centers;
}

function nearest(centers: Float32Array, L: number, A: number, B: number): number {
    let bd = Infinity;
    for (let c = 0; c < centers.length; c += 3) {
        const dl = L - centers[c], da = A - centers[c + 1], db = B - centers[c + 2];
        const d = dl * dl * 0.6 + da * da + db * db; // a luz conta um pouco menos que a cor
        if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
}

/**
 * Distância ao fundo que perdoa sombras: um ponto mais escuro com a "mesma cor" do fundo (a cor encolhe com a luz)
 * é sombra do fundo, não produto.
 */
function nearestBg(centers: Float32Array, L: number, A: number, B: number): number {
    let best = nearest(centers, L, A, B);
    for (let c = 0; c < centers.length; c += 3) {
        const Lc = centers[c];
        if (L >= Lc * 0.95 || L <= Lc * 0.3) continue;
        const k = Lc / Math.max(L, 1);
        const da = A * k - centers[c + 1], db = B * k - centers[c + 2];
        const ds = Math.sqrt(da * da + db * db) * 1.2 + 4;
        if (ds < best) best = ds;
    }
    return best;
}

function sample(lab: Float32Array, pick: (i: number) => boolean, n: number, max = 4000): Float32Array {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (pick(i)) idx.push(i);
    const step = Math.max(1, Math.floor(idx.length / max));
    const out: number[] = [];
    for (let j = 0; j < idx.length; j += step) { const i = idx[j]; out.push(lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]); }
    return new Float32Array(out);
}

/**
 * Máscara do produto (0–1 por ponto) numa imagem pequena (≈ 300–500 px). `null` quando não dá para separar com
 * confiança (ex.: produto da mesma cor do fundo) — aí fica a foto original.
 */
export function segmentProduct(img: Pixels): Float32Array | null {
    const { width: W, height: H, data } = img;
    const N = W * H;
    if (W < 16 || H < 16) return null;

    // 1. Lab + contornos (Sobel na luz e na cor)
    const lab = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        const [L, A, B] = toLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
        lab[i * 3] = L; lab[i * 3 + 1] = A; lab[i * 3 + 2] = B;
    }
    // 3 passagens de média 3×3 (≈ desfoque gaussiano): o grão da câmara deixa de parecer contorno
    let smooth = lab;
    for (let pass = 0; pass < 3; pass++) {
        const out = new Float32Array(N * 3);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let ch = 0; ch < 3; ch++) {
            let t = 0, n = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx, yy = y + dy;
                if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                t += smooth[(yy * W + xx) * 3 + ch]; n++;
            }
            out[(y * W + x) * 3 + ch] = t / n;
        }
        smooth = out;
    }
    const grad = new Float32Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        let g = 0;
        for (let ch = 0; ch < 3; ch++) {
            const v = (xx: number, yy: number) => smooth[(yy * W + xx) * 3 + ch];
            const gx = v(x + 1, y - 1) + 2 * v(x + 1, y) + v(x + 1, y + 1) - v(x - 1, y - 1) - 2 * v(x - 1, y) - v(x - 1, y + 1);
            const gy = v(x - 1, y + 1) + 2 * v(x, y + 1) + v(x + 1, y + 1) - v(x - 1, y - 1) - 2 * v(x, y - 1) - v(x + 1, y - 1);
            g += gx * gx + gy * gy;
        }
        const i = y * W + x;
        grad[i] = Math.sqrt(g);
    }
    // contornos medidos em relação aos fortes típicos da foto (percentil 95), não só ao mais forte de todos: assim um
    // contorno suave (saco cinzento num chão cinzento) também conta como fronteira
    const sorted = Float32Array.from(grad).sort();
    const ref = Math.max(EPS, sorted[Math.floor(sorted.length * 0.95)]);
    for (let i = 0; i < N; i++) grad[i] = Math.min(1, grad[i] / ref);

    // 2. Onde aprender: bordas = fundo; centro = produto (aproximado)
    const band = Math.max(2, Math.round(Math.min(W, H) * 0.06));
    const isBorder = (i: number) => { const x = i % W, y = (i / W) | 0; return x < band || y < band || x >= W - band || y >= H - band; };
    const cx = W / 2, cy = H / 2;
    const inCenter = (i: number, r = 0.3) => { const x = i % W, y = (i / W) | 0; const dx = (x - cx) / (W * r), dy = (y - cy) / (H * r); return dx * dx + dy * dy <= 1; };
    const prior = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0; const dx = (x - cx) / (W * 0.4), dy = (y - cy) / (H * 0.4); prior[i] = Math.exp(-(dx * dx + dy * dy)); }

    // pontos fixos: a moldura de fora é sempre fundo
    const ring = Math.max(1, Math.round(band / 3));
    const fixedBg = (i: number) => { const x = i % W, y = (i / W) | 0; return x < ring || y < ring || x >= W - ring || y >= H - ring; };

    // Fundo POR LADO (cima, baixo, esquerda, direita): cada ponto compara-se com o fundo dos dois lados mais perto dele.
    // Assim um desenho branco na parede de cima não faz o branco do produto, lá em baixo, parecer fundo.
    type Side = 0 | 1 | 2 | 3;
    const sideOf = (i: number, s: Side, band: number) => { const x = i % W, y = (i / W) | 0; return s === 0 ? y < band : s === 1 ? y >= H - band : s === 2 ? x < band : x >= W - band; };
    const sideModels = (pick: (i: number) => boolean, depth: number): (Float32Array | null)[] =>
        ([0, 1, 2, 3] as Side[]).map((s) => { const smp = sample(lab, (i) => pick(i) && sideOf(i, s, depth), N, 2500); return smp.length >= 30 ? kmeans(smp, 3, 4) : null; });
    const nearSides = (i: number): [Side, Side] => {
        const x = i % W, y = (i / W) | 0;
        const d: [number, Side][] = [[y, 0], [H - 1 - y, 1], [x, 2], [W - 1 - x, 3]];
        d.sort((a, b) => a[0] - b[0]);
        return [d[0][1], d[1][1]];
    };
    const sideDist = (models: (Float32Array | null)[], i: number) => {
        const L = lab[i * 3], A = lab[i * 3 + 1], B = lab[i * 3 + 2];
        let best = Infinity;
        for (const s of nearSides(i)) { const m = models[s]; if (m) best = Math.min(best, nearestBg(m, L, A, B)); }
        if (best === Infinity) for (const m of models) if (m) best = Math.min(best, nearestBg(m, L, A, B));
        return best;
    };
    let bgSides = sideModels(isBorder, band);
    const borderSides = bgSides; // as cores das bordas, para a verificação de confiança no fim
    // produto: o centro sem as cores que já são do fundo
    const bgDist = (i: number) => sideDist(bgSides, i);
    let fgSample = sample(lab, (i) => inCenter(i, 0.2) && bgDist(i) > 12, N);
    if (fgSample.length < 30) fgSample = sample(lab, (i) => inCenter(i, 0.15), N);
    let fgC = kmeans(fgSample, 3, 6);

    // pista "como uma pessoa": a partir do centro, pinta até bater num contorno; se a zona ficar fechada (não chega às
    // bordas da foto), é um objeto — mesmo que tenha quase a cor do fundo (saco cinzento num chão cinzento)
    const enclosed = new Uint8Array(N);
    {
        const seen = new Uint8Array(N);
        const seeds: number[] = [];
        for (const fy of [0.42, 0.5, 0.58]) for (const fx of [0.42, 0.5, 0.58]) seeds.push(Math.round(H * fy) * W + Math.round(W * fx));
        for (const s0 of seeds) {
            if (seen[s0] || grad[s0] > 0.35) continue;
            const region: number[] = [];
            let open = false;
            const stack = [s0];
            seen[s0] = 1;
            while (stack.length) {
                const i = stack.pop()!;
                region.push(i);
                if (isBorder(i)) open = true;
                const x = i % W, y = (i / W) | 0;
                const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
                for (const j of nb) if (j >= 0 && !seen[j] && grad[j] <= 0.35) { seen[j] = 1; stack.push(j); }
            }
            if (!open && region.length > N * 0.01) for (const i of region) enclosed[i] = 1;
        }
    }

    let p = new Float32Array(N);
    // o que se alcança a partir da borda sem atravessar um contorno (preenchido na 2.ª volta)
    let outside: Uint8Array | null = null;
    const weights = (i: number, j: number) => Math.exp(-14 * Math.max(grad[i], grad[j]));
    const solve = () => {
        // probabilidade "pelos dados" (cores + centro)
        const p0 = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const L = lab[i * 3], A = lab[i * 3 + 1], B = lab[i * 3 + 2];
            const db = sideDist(bgSides, i), df = nearest(fgC, L, A, B);
            const pc = db / (db + df + EPS);
            p0[i] = fixedBg(i) ? 0 : enclosed[i] ? Math.max(0.75, 0.7 * pc + 0.3 * prior[i]) : 0.7 * pc + 0.3 * prior[i];
        }
        // espalhar pelos vizinhos, parando nos contornos (Jacobi de uma suavização que respeita arestas)
        p = p0.slice();
        const next = new Float32Array(N);
        const lambda = 0.5;
        for (let it = 0; it < 60; it++) {
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const i = y * W + x;
                if (fixedBg(i)) { next[i] = 0; continue; }
                let s = lambda * p0[i], w = lambda;
                if (x > 0) { const ww = weights(i, i - 1); s += ww * p[i - 1]; w += ww; }
                if (x < W - 1) { const ww = weights(i, i + 1); s += ww * p[i + 1]; w += ww; }
                if (y > 0) { const ww = weights(i, i - W); s += ww * p[i - W]; w += ww; }
                if (y < H - 1) { const ww = weights(i, i + W); s += ww * p[i + W]; w += ww; }
                next[i] = s / w;
            }
            p.set(next);
        }
    };

    solve();
    // 2.ª volta: reaprende as cores com o que a 1.ª separou — o produto só do objeto central; tudo o resto (incluindo
    // coisas soltas que pareciam produto, ex.: caixas de uma prateleira) passa a ensinar o que é fundo
    const first = new Uint8Array(N);
    for (let i = 0; i < N; i++) first[i] = p[i] > 0.5 ? 1 : 0;
    const core = keepMain(first, W, H, true);
    const fgS = sample(lab, (i) => core[i] === 1 && p[i] > 0.6, N);
    const notCore = (i: number) => !core[i] && !fixedBg(i);
    if (fgS.length >= 30 && sample(lab, notCore, N, 100).length >= 30) {
        fgC = kmeans(fgS, 3, 8);
        // zonas fechadas por contornos (da borda não se chega lá sem atravessar um) que já são quase todas produto passam
        // a ser produto inteiras: ex.: a parte de baixo do frasco, mais escura, na sombra de um balde escuro
        {
            // contornos um ponto mais grossos: fecha as falhas pequenas no contorno do produto
            const wall = grow(Uint8Array.from(grad, (g) => (g > 0.35 ? 1 : 0)), W, H, 1);
            const out = new Uint8Array(N);
            const stack: number[] = [];
            for (let i = 0; i < N; i++) if (fixedBg(i)) { out[i] = 1; stack.push(i); }
            while (stack.length) {
                const i = stack.pop()!;
                const x = i % W, y = (i / W) | 0;
                const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
                for (const j of nb) if (j >= 0 && !out[j] && !wall[j]) { out[j] = 1; stack.push(j); }
            }
            outside = out;
            const seen = new Uint8Array(N);
            for (let s0 = 0; s0 < N; s0++) {
                if (out[s0] || wall[s0] || seen[s0]) continue;
                const comp: number[] = [];
                let inCore = 0;
                seen[s0] = 1; stack.push(s0);
                while (stack.length) {
                    const i = stack.pop()!;
                    comp.push(i);
                    if (core[i]) inCore++;
                    const x = i % W, y = (i / W) | 0;
                    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
                    for (const j of nb) if (j >= 0 && !out[j] && !wall[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
                }
                if (inCore >= comp.length * 0.5) for (const i of comp) enclosed[i] = 1;
            }
            // silhueta: tudo o que fica dentro do contorno fechado à volta do produto (contornos incluídos). Se é só um
            // pouco maior do que o produto achado, confia-se nela: o que faltava (ex.: um canto em baixo, na sombra)
            // entra, sem a faixa do contorno do lado de fora e sem sair da caixa do produto.
            // As fugas finas para dentro do produto (letras miúdas junto à borda) não contam como "fora": abre-se o
            // "fora" com um disco pequeno e fica só o que continua ligado à borda da foto.
            const inv = (a: Uint8Array) => a.map((v) => (v ? 0 : 1));
            const opened = grow(inv(grow(inv(out), W, H, 2)), W, H, 2);
            const wide = new Uint8Array(N);
            for (let i = 0; i < N; i++) if (fixedBg(i) && opened[i]) { wide[i] = 1; stack.push(i); }
            while (stack.length) {
                const i = stack.pop()!;
                const x = i % W, y = (i / W) | 0;
                const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
                for (const j of nb) if (j >= 0 && opened[j] && !wide[j]) { wide[j] = 1; stack.push(j); }
            }
            const sil = new Uint8Array(N);
            let coreN = 0, silN = 0, both = 0;
            let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
            for (let i = 0; i < N; i++) if (core[i]) {
                coreN++;
                const x = i % W, y = (i / W) | 0;
                if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
                if (!wide[i]) { sil[i] = 1; stack.push(i); }
            }
            while (stack.length) {
                const i = stack.pop()!;
                silN++; if (core[i]) both++;
                const x = i % W, y = (i / W) | 0;
                const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
                for (const j of nb) if (j >= 0 && !wide[j] && !sil[j]) { sil[j] = 1; stack.push(j); }
            }
            if (coreN && both >= coreN * 0.8 && silN <= coreN * 1.3) {
                const rim = grow(wide, W, H, 3);
                for (let i = 0; i < N; i++) {
                    const x = i % W, y = (i / W) | 0;
                    if (sil[i] && !rim[i] && x >= bx0 && x <= bx1 && y >= by0 && y <= by1) enclosed[i] = 1;
                }
            }
        }
        // o fundo de cada lado passa a ser tudo o que não é o produto nessa metade da foto
        const half = Math.round(Math.min(W, H) / 2);
        const fresh = sideModels(notCore, half);
        bgSides = fresh.map((m, k) => m || bgSides[k]);
        solve();
    }

    // 3. Limpeza: binário → só o objeto principal → sem buracos
    let mask: Uint8Array = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = p[i] > 0.5 ? 1 : 0;
    mask = morph(mask, W, H, 'close');
    mask = morph(mask, W, H, 'open');
    // um produto não "acaba e recomeça": uma faixa estreita que ficou de fora entre duas partes (ex.: a faixa castanha
    // de um rótulo, da cor da mão que segura o frasco) volta a ser produto
    // (só por cima de zonas que não são claramente fundo: a prateleira entre uma garrafa e as caixas não se preenche)
    mask = bridgeGaps(mask, W, H, Math.round(H * 0.14), Math.round(W * 0.06), (i) => p[i] >= 0.18);
    mask = keepMain(mask, W, H);
    mask = fillHoles(mask, W, H);
    // os dedos da mão que segura o produto (finos e a ir dar à borda da foto) saem
    mask = dropAppendages(mask, W, H, Math.max(3, Math.round(Math.min(W, H) * 0.04)), isBorder);
    // falhas dentro do contorno fechado do produto (ex.: o fundo do frasco, entre duas partes que ficaram) voltam a ser
    // produto, por maiores que sejam; o fundo aberto (a parede entre o gargalo e os livros) nunca
    const out = outside;
    if (out) mask = bridgeGaps(mask, W, H, H, W, (i) => !out[i] && !fixedBg(i));
    mask = smoothEdge(mask, W, H, Math.max(2, Math.round(Math.min(W, H) * 0.012)));
    mask = keepMain(mask, W, H);
    mask = fillHoles(mask, W, H);

    let area = 0, diff = 0;
    for (let i = 0; i < N; i++) if (mask[i]) { area++; diff += sideDist(borderSides, i); }
    const frac = area / N;
    if (frac < 0.02 || frac > 0.95) return null;
    // confiança: o que ficou como produto tem de ser, em média, bem diferente do fundo (senão é só fundo "inventado")
    if (diff / area < 10) return null;

    // contornos suaves (sem "serrilhado")
    const soft = new Float32Array(N);
    for (let i = 0; i < N; i++) soft[i] = mask[i];
    return blur(blur(soft, W, H), W, H);
}

/** Alarga a máscara `steps` pontos (alternando cruz e quadrado: fica quase um disco). */
function grow(m: Uint8Array, W: number, H: number, steps: number): Uint8Array {
    let cur = m;
    for (let k = 0; k < steps; k++) {
        const out = cur.slice();
        const diag = k % 2 === 1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (cur[i]) continue;
            const l = x > 0, r = x < W - 1, u = y > 0, d = y < H - 1;
            if ((l && cur[i - 1]) || (r && cur[i + 1]) || (u && cur[i - W]) || (d && cur[i + W]) ||
                (diag && ((l && u && cur[i - W - 1]) || (r && u && cur[i - W + 1]) || (l && d && cur[i + W - 1]) || (r && d && cur[i + W + 1])))) out[i] = 1;
        }
        cur = out;
    }
    return cur;
}

/**
 * Tira os "apêndices" finos que vão dar à borda da foto (ex.: os dedos da mão que segura o produto): uma abertura com
 * um disco de raio r deixa só o corpo (o que é mais fino que 2r desaparece); de tudo o que ficou de fora, sai só o que
 * toca a borda — a asa de uma caneca ou o gargalo de uma garrafa ficam.
 */
function dropAppendages(m: Uint8Array, W: number, H: number, r: number, isBorder: (i: number) => boolean): Uint8Array {
    const inv = (a: Uint8Array) => a.map((v) => (v ? 0 : 1));
    const body = keepMain(grow(inv(grow(inv(m), W, H, r)), W, H, r), W, H, true);
    if (!body.some((v) => v)) return m;
    const out = m.slice();
    const seen = new Uint8Array(m.length);
    const stack: number[] = [];
    for (let s = 0; s < m.length; s++) {
        if (!m[s] || body[s] || seen[s]) continue;
        const comp: number[] = [];
        let touches = false;
        seen[s] = 1; stack.push(s);
        while (stack.length) {
            const i = stack.pop()!;
            comp.push(i);
            if (isBorder(i)) touches = true;
            const x = i % W, y = (i / W) | 0;
            const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
            for (const j of nb) if (j >= 0 && m[j] && !body[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
        if (touches) for (const i of comp) out[i] = 0;
    }
    return keepMain(out, W, H);
}

/** Alisa o contorno: média num quadrado de lado 2r+1 e volta a cortar a meio (tira dentes e mossas pequenas). */
function smoothEdge(m: Uint8Array, W: number, H: number, r: number): Uint8Array {
    // somas acumuladas: o custo não depende de r
    const S = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += m[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
    const out = new Uint8Array(m.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(W, x + r + 1), y1 = Math.min(H, y + r + 1);
        const t = S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
        out[y * W + x] = t / ((x1 - x0) * (y1 - y0)) > 0.5 ? 1 : 0;
    }
    return out;
}

function morph(m: Uint8Array, W: number, H: number, op: 'open' | 'close'): Uint8Array {
    const pass = (src: Uint8Array, dilate: boolean) => {
        const out = new Uint8Array(src.length);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let v = dilate ? 0 : 1;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx, yy = y + dy;
                const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : src[yy * W + xx];
                if (dilate ? s : !s) { v = dilate ? 1 : 0; }
            }
            out[y * W + x] = v;
        }
        return out;
    };
    return op === 'close' ? pass(pass(m, true), false) : pass(pass(m, false), true);
}

/** Preenche espaços curtos (≤ gy na vertical, ≤ gx na horizontal) entre duas partes da máscara. */
function bridgeGaps(m: Uint8Array, W: number, H: number, gy: number, gx: number, fillable: (i: number) => boolean): Uint8Array {
    const out = m.slice();
    const can = (from: number, to: number, idx: (k: number) => number) => { for (let k = from; k < to; k++) if (!fillable(idx(k))) return false; return true; };
    for (let x = 0; x < W; x++) {
        let last = -1;
        for (let y = 0; y < H; y++) if (m[y * W + x]) {
            const gap = y - last - 1;
            if (last >= 0 && gap > 0 && gap <= gy && can(last + 1, y, (k) => k * W + x)) for (let k = last + 1; k < y; k++) out[k * W + x] = 1;
            last = y;
        }
    }
    for (let y = 0; y < H; y++) {
        let last = -1;
        for (let x = 0; x < W; x++) if (out[y * W + x]) {
            const gap = x - last - 1;
            if (last >= 0 && gap > 0 && gap <= gx && can(last + 1, x, (k) => y * W + k)) for (let k = last + 1; k < x; k++) out[y * W + k] = 1;
            last = x;
        }
    }
    return out;
}

/** Fica só com o objeto principal (e com pedaços grandes que façam parte dele, ex.: uma asa separada). */
function keepMain(m: Uint8Array, W: number, H: number, onlyMain = false): Uint8Array {
    const label = new Int32Array(m.length).fill(-1);
    const sizes: number[] = [];
    const centerHits: number[] = [];
    const cx = W / 2, cy = H / 2;
    const stack: number[] = [];
    for (let s = 0; s < m.length; s++) {
        if (!m[s] || label[s] >= 0) continue;
        const id = sizes.length;
        let size = 0, center = 0;
        label[s] = id; stack.push(s);
        while (stack.length) {
            const i = stack.pop()!;
            size++;
            const x = i % W, y = (i / W) | 0;
            if (Math.abs(x - cx) < W * 0.2 && Math.abs(y - cy) < H * 0.2) center++;
            const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
            for (const j of nb) if (j >= 0 && m[j] && label[j] < 0) { label[j] = id; stack.push(j); }
        }
        sizes.push(size); centerHits.push(center);
    }
    if (!sizes.length) return m;
    // o principal: o que mais toca o centro (empate → o maior)
    let main = 0;
    for (let k = 1; k < sizes.length; k++) if (centerHits[k] > centerHits[main] || (centerHits[k] === centerHits[main] && sizes[k] > sizes[main])) main = k;
    // pedaços grandes MESMO encostados ao principal fazem parte dele (ex.: a asa de uma caneca); coisas soltas noutros
    // sítios (caixas de uma prateleira atrás) ficam de fora
    const near = new Uint8Array(sizes.length);
    near[main] = 1;
    if (!onlyMain) {
        const r = Math.max(2, Math.round(Math.min(W, H) * 0.02));
        const reach = new Uint8Array(m.length);
        for (let i = 0; i < m.length; i++) if (label[i] === main) reach[i] = 1;
        for (let k = 0; k < r; k++) { // alarga o principal r pontos
            const prev = reach.slice();
            for (let i = 0; i < m.length; i++) if (prev[i]) {
                const x = i % W, y = (i / W) | 0;
                if (x > 0) reach[i - 1] = 1; if (x < W - 1) reach[i + 1] = 1; if (y > 0) reach[i - W] = 1; if (y < H - 1) reach[i + W] = 1;
            }
        }
        for (let i = 0; i < m.length; i++) { const l = label[i]; if (l >= 0 && !near[l] && reach[i] && sizes[l] >= sizes[main] * 0.05) near[l] = 1; }
    }
    const out = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) { const l = label[i]; if (l >= 0 && near[l]) out[i] = 1; }
    return out;
}

/** Tapa os buracos dentro do produto (reflexos, letras claras do rótulo). */
function fillHoles(m: Uint8Array, W: number, H: number): Uint8Array {
    const outside = new Uint8Array(m.length);
    const stack: number[] = [];
    const push = (i: number) => { if (!m[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (stack.length) {
        const i = stack.pop()!;
        const x = i % W, y = (i / W) | 0;
        if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W);
    }
    const out = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) out[i] = outside[i] ? 0 : 1;
    return out;
}

function blur(src: Float32Array, W: number, H: number): Float32Array {
    const out = new Float32Array(src.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            s += src[yy * W + xx]; n++;
        }
        out[y * W + x] = s / n;
    }
    return out;
}

/** Caixa do produto na máscara (em frações 0–1 da imagem). */
export function maskBox(mask: Float32Array, W: number, H: number): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x] > 0.5) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    return { x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H };
}
