"use client";

// Foto de estúdio no navegador (sem IA, sem internet): recorta o produto (lib/studio-photo.ts) e põe-no num quadrado
// branco, centrado, com margem e uma sombra suave. Devolve null quando não dá para separar com confiança.
import { maskBox, segmentProduct } from "@/lib/studio-photo";

/** Lado da imagem pequena onde se faz o recorte (rápido mesmo em telemóveis fracos). */
const WORK = 360;
/** Lado da foto final. */
const OUT = 1024;

function canvas(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
}

/**
 * Reduz a foto em passos de metade (cada passo faz a média de 2×2 pontos) e só no fim ao tamanho pedido. Um salto
 * grande de uma vez (ex.: 4000 → 360) salta pontos e deixa "grão", que o recorte confunde com contornos.
 */
function shrink(src: CanvasImageSource, sw: number, sh: number, w: number, h: number, read = false): HTMLCanvasElement {
    let cur = src, cw = sw, ch = sh;
    while (cw / 2 >= w && ch / 2 >= h) {
        const nw = Math.round(cw / 2), nh = Math.round(ch / 2);
        const c = canvas(nw, nh);
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cur, 0, 0, nw, nh);
        cur = c; cw = nw; ch = nh;
    }
    const out = canvas(w, h);
    const ctx = out.getContext("2d", { willReadFrequently: read })!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, w, h);
    return out;
}

export async function makeStudioPhoto(file: Blob): Promise<Blob | null> {
    const bmp = await createImageBitmap(file);
    try {
        // 1. Recorte numa cópia pequena
        const s = Math.min(1, WORK / Math.max(bmp.width, bmp.height));
        const w = Math.max(16, Math.round(bmp.width * s)), h = Math.max(16, Math.round(bmp.height * s));
        const sctx = shrink(bmp, bmp.width, bmp.height, w, h, true).getContext("2d", { willReadFrequently: true })!;
        const mask = segmentProduct(sctx.getImageData(0, 0, w, h));
        if (!mask) return null;
        const box = maskBox(mask, w, h);
        if (!box) return null;

        // 2. Máscara em tamanho real (alisada ao aumentar)
        const big = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const W = Math.round(bmp.width * big), H = Math.round(bmp.height * big);
        const m = canvas(w, h);
        const mctx = m.getContext("2d")!;
        const md = mctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) { md.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (mask[i] - 0.15) / 0.7)) * 255); }
        mctx.putImageData(md, 0, 0);

        const cut = shrink(bmp, bmp.width, bmp.height, W, H);
        const cctx = cut.getContext("2d")!;
        cctx.globalCompositeOperation = "destination-in";
        cctx.imageSmoothingEnabled = true;
        cctx.imageSmoothingQuality = "high";
        cctx.drawImage(m, 0, 0, W, H);

        // 3. Quadrado branco, produto centrado (80% do espaço), sombra suave por baixo
        const px = box.x0 * W, py = box.y0 * H, pw = (box.x1 - box.x0) * W, ph = (box.y1 - box.y0) * H;
        const fit = (OUT * 0.8) / Math.max(pw, ph);
        const dw = pw * fit, dh = ph * fit;
        const dx = (OUT - dw) / 2, dy = (OUT - dh) / 2;
        const out = canvas(OUT, OUT);
        const o = out.getContext("2d")!;
        o.fillStyle = "#ffffff";
        o.fillRect(0, 0, OUT, OUT);
        o.save();
        o.filter = "blur(14px)";
        o.fillStyle = "rgba(0,0,0,0.13)";
        o.beginPath();
        o.ellipse(OUT / 2, dy + dh - dh * 0.01, dw * 0.42, Math.max(8, dh * 0.035), 0, 0, Math.PI * 2);
        o.fill();
        o.restore();
        o.filter = "brightness(1.04) contrast(1.04)";
        o.drawImage(cut, px, py, pw, ph, dx, dy, dw, dh);
        o.filter = "none";

        return await new Promise<Blob | null>((res) => out.toBlob(res, "image/jpeg", 0.9));
    } finally {
        bmp.close();
    }
}
