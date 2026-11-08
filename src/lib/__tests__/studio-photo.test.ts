import { describe, expect, it } from 'vitest';
import { maskBox, segmentProduct } from '../studio-photo';

const W = 160, H = 160;
type RGB = [number, number, number];
function makeImage(bg: (x: number, y: number) => RGB, fg: (x: number, y: number) => RGB | null) {
    const data = new Uint8ClampedArray(W * H * 4);
    const truth = new Uint8Array(W * H);
    let seed = 7;
    const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 15) - 7; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const f = fg(x, y);
        const c = f || bg(x, y);
        if (f) truth[y * W + x] = 1;
        const i = (y * W + x) * 4;
        data[i] = c[0] + noise(); data[i + 1] = c[1] + noise(); data[i + 2] = c[2] + noise(); data[i + 3] = 255;
    }
    return { img: { width: W, height: H, data }, truth };
}
const iou = (mask: Float32Array, truth: Uint8Array) => {
    let inter = 0, uni = 0;
    for (let i = 0; i < truth.length; i++) { const m = mask[i] > 0.5 ? 1 : 0; inter += m & truth[i]; uni += m | truth[i]; }
    return inter / uni;
};
const circle = (r: number, c: RGB) => (x: number, y: number): RGB | null => ((x - 80) ** 2 + (y - 82) ** 2 <= r * r ? c : null);

describe('foto de estúdio sem IA: separar o produto do fundo', () => {
    it('produto num fundo liso', () => {
        const { img, truth } = makeImage(() => [235, 235, 230], circle(40, [190, 40, 40]));
        const m = segmentProduct(img)!;
        expect(m).not.toBeNull();
        expect(iou(m, truth)).toBeGreaterThan(0.9);
    });

    it('fundo complicado: riscas de várias cores, madeira e azulejo', () => {
        const busy = (x: number, y: number): RGB => {
            const band = Math.floor(x / 12) % 3;
            if (y > 120) return [120 + (x % 7) * 3, 80, 45]; // balcão de madeira
            return band === 0 ? [90, 130, 90] : band === 1 ? [200, 200, 190] : [140, 120, 160];
        };
        const product = (x: number, y: number): RGB | null => (x >= 55 && x < 105 && y >= 40 && y < 130 ? [30, 70, 200] : null);
        const { img, truth } = makeImage(busy, product);
        const m = segmentProduct(img)!;
        expect(m).not.toBeNull();
        expect(iou(m, truth)).toBeGreaterThan(0.85);
    });

    it('rótulo claro dentro do produto não fica como buraco', () => {
        const product = (x: number, y: number): RGB | null => {
            if (!(x >= 50 && x < 110 && y >= 40 && y < 125)) return null;
            return x >= 65 && x < 95 && y >= 70 && y < 95 ? [245, 245, 240] : [20, 120, 60]; // rótulo branco
        };
        const { img, truth } = makeImage(() => [225, 225, 222], product);
        const m = segmentProduct(img)!;
        expect(iou(m, truth)).toBeGreaterThan(0.85);
    });

    it('produto quase da cor do fundo (saco cinzento num chão cinzento)', () => {
        const bag = (x: number, y: number): RGB | null => {
            if (!(x >= 45 && x < 115 && y >= 35 && y < 130)) return null;
            return x >= 55 && x < 105 && y >= 55 && y < 75 ? [30, 95, 170] : [163, 163, 156]; // rótulo azul
        };
        const { img, truth } = makeImage(() => [138, 138, 134], bag);
        const m = segmentProduct(img)!;
        expect(m).not.toBeNull();
        expect(iou(m, truth)).toBeGreaterThan(0.85);
    });

    it('como uma foto real: frasco branco com faixa castanha, seguro por uma mão, com desenhos brancos na parede', () => {
        const wall = (x: number, y: number): RGB => {
            if (y < 14 && x % 40 < 18) return [245, 245, 240]; // desenhos brancos na parede, junto à borda de cima
            return y < 90 ? [225, 110, 70] : [25, 25, 30];     // parede laranja em cima, preto em baixo
        };
        const jar = (x: number, y: number): RGB | null => {
            if (x >= 40 && x < 120 && y >= 18 && y < 128) return y >= 100 && y < 112 ? [120, 85, 55] : [228, 228, 232]; // faixa castanha
            if (x >= 55 && x < 105 && y >= 128) return [110, 75, 50]; // a mão (da cor da faixa), até à borda de baixo
            return null;
        };
        const { img } = makeImage(wall, jar);
        const truth = new Uint8Array(W * H);
        for (let y = 18; y < 128; y++) for (let x = 40; x < 120; x++) truth[y * W + x] = 1; // o produto é só o frasco
        const m = segmentProduct(img)!;
        expect(m).not.toBeNull();
        expect(iou(m, truth)).toBeGreaterThan(0.8);
    });

    it('frasco branco num balde escuro: a parte de baixo, na sombra e com letras pequenas, não fica cortada', () => {
        const inJar = (x: number, y: number) => x >= 45 && x < 115 && y >= 25 && y < 135;
        const jar = (x: number, y: number): RGB | null => {
            if (!inJar(x, y)) return null;
            if (y >= 95 && y < 104) return [120, 85, 55]; // faixa castanha
            if (y >= 104) return y % 6 < 2 && x % 5 < 3 ? [40, 40, 40] : [85, 85, 88]; // em baixo: sombra com letras
            return [228, 228, 232];
        };
        const { img, truth } = makeImage(() => [30, 30, 34], jar);
        const m = segmentProduct(img)!;
        expect(m).not.toBeNull();
        let bottom = 0, total = 0;
        for (let y = 104; y < 135; y++) for (let x = 45; x < 115; x++) { total++; if (m[y * W + x] > 0.5) bottom++; }
        expect(bottom / total).toBeGreaterThan(0.6);
        expect(iou(m, truth)).toBeGreaterThan(0.88);
    });

    it('a asa de uma caneca (fina, mas longe da borda) fica', () => {
        const mug = (x: number, y: number): RGB | null => {
            if (x >= 50 && x < 105 && y >= 45 && y < 120) return [200, 40, 40];
            const d = Math.hypot(x - 105, y - 82);
            return x >= 105 && d >= 14 && d < 20 ? [200, 40, 40] : null; // asa: arco com 6 pontos de grossura
        };
        const { img, truth } = makeImage(() => [235, 235, 230], mug);
        const m = segmentProduct(img)!;
        expect(m).not.toBeNull();
        let handle = 0, kept = 0;
        for (let y = 0; y < H; y++) for (let x = 112; x < W; x++) if (truth[y * W + x]) { handle++; if (m[y * W + x] > 0.5) kept++; }
        expect(kept / handle).toBeGreaterThan(0.8);
    });

    it('foto sem produto (tudo da mesma cor): não inventa', () => {
        const { img } = makeImage(() => [128, 128, 128], () => null);
        expect(segmentProduct(img)).toBeNull();
    });

    it('caixa do produto', () => {
        const { img } = makeImage(() => [235, 235, 230], circle(30, [190, 40, 40]));
        const b = maskBox(segmentProduct(img)!, W, H)!;
        expect(b.x0).toBeGreaterThan(0.25); expect(b.x1).toBeLessThan(0.75);
        expect(b.y0).toBeGreaterThan(0.25); expect(b.y1).toBeLessThan(0.75);
    });
});
