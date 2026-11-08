import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PhoneScene } from "./PhoneScene";
import { C, fontFamily } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, alignItems: "center", justifyContent: "center", padding: 100, textAlign: "center" }}>
      <Img src={staticFile("logo.png")} style={{ width: 220, height: 220, borderRadius: 48, scale: spring({ frame, fps, config: { damping: 12 } }) }} />
      <h1 style={{ color: C.text, fontSize: 116, fontWeight: 700, lineHeight: 1.05, marginTop: 70, opacity: interpolate(frame, [8, 22], [0, 1], clamp), translate: interpolate(frame, [8, 22], ["0px 40px", "0px 0px"], clamp) }}>
        O seu stock <span style={{ color: C.blue }}>sempre certo</span>
      </h1>
      <p style={{ color: C.muted, fontSize: 52, marginTop: 30, opacity: interpolate(frame, [24, 38], [0, 1], clamp) }}>
        Entradas, variações e inventário — no telemóvel
      </p>
    </AbsoluteFill>
  );
};

/** 1. Entrada de stock: "cimento 50" → lote (240 → 290) → confirmar */
export const Entrada: React.FC = () => (
  <PhoneScene
    step={1}
    title="Entrada de stock"
    shots={[
      { from: 0, file: "a1-entrada.png", caption: "Chegou mercadoria? Abra o Stock Rápido" },
      { from: 45, file: "a2-escrever.png", caption: "Escreva: cimento 50" },
      { from: 100, file: "a3-lote.png", caption: "No lote: 240 → 290 sacos" },
      { from: 175, file: "a4-feito.png", caption: "Entrada registada ✅" },
    ]}
    taps={[{ at: 30, x: 130, y: 181 }, { at: 85, x: 195, y: 320 }, { at: 160, x: 264, y: 748 }]}
    marks={[{ from: 108, to: 160, x: 10, y: 310, w: 370, h: 62 }, { from: 182, to: 240, x: 10, y: 12, w: 370, h: 76 }]}
  />
);

/** 2. Produto novo com variações: Pavê em 3 cores, cada uma com a sua quantidade */
export const Variacoes: React.FC = () => (
  <PhoneScene
    step={2}
    title="Produto com variações"
    shots={[
      { from: 0, file: "b1-pave.png", caption: "Escreva o produto novo: Pavê" },
      { from: 45, file: "b2-novo.png", caption: "A categoria é sugerida sozinha" },
      { from: 100, file: "b3-variacoes.png", caption: "Cores e quantidades de uma vez" },
      { from: 200, file: "b4-lote.png", caption: "3 variações no lote ✅" },
    ]}
    taps={[{ at: 32, x: 180, y: 298 }, { at: 88, x: 324, y: 722 }, { at: 186, x: 195, y: 706 }, { at: 278, x: 264, y: 748 }]}
    marks={[
      { from: 112, to: 150, x: 26, y: 178, w: 340, h: 30, color: C.blue },
      { from: 150, to: 188, x: 40, y: 418, w: 310, h: 140 },
      { from: 208, to: 278, x: 10, y: 308, w: 370, h: 182 },
    ]}
  />
);

/** 3. Inventário: a família agrupada, cada variação com o seu stock, e os alertas */
export const Inventario: React.FC = () => (
  <PhoneScene
    step={3}
    title="Inventário sempre certo"
    shots={[
      { from: 0, file: "c1-inventario.png", caption: "Cimento já com 290 sacos" },
      { from: 70, file: "c2-familia.png", caption: "Cada cor com o seu stock" },
      { from: 130, file: "c2-familia.png", caption: "E avisa o que está a acabar" },
    ]}
    taps={[{ at: 55, x: 200, y: 413 }]}
    marks={[
      { from: 8, to: 50, x: 10, y: 460, w: 370, h: 56 },
      { from: 76, to: 128, x: 10, y: 450, w: 370, h: 178 },
      { from: 134, to: 185, x: 10, y: 738, w: 370, h: 52, color: C.amber },
    ]}
  />
);

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = (a: number) => ({ opacity: interpolate(frame, [a, a + 12], [0, 1], clamp) });
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, alignItems: "center", justifyContent: "center", padding: 100, textAlign: "center" }}>
      <h1 style={{ color: C.text, fontSize: 96, fontWeight: 700, lineHeight: 1.1, ...fade(0) }}>
        Sem cadernos.<br /><span style={{ color: C.green }}>Sem contas de cabeça.</span>
      </h1>
      <p style={{ color: C.muted, fontSize: 48, marginTop: 30, ...fade(12) }}>Funciona no telemóvel, mesmo sem internet.</p>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 110, ...fade(28) }}>
        <Img src={staticFile("logo.png")} style={{ width: 120, height: 120, borderRadius: 28 }} />
        <span style={{ color: C.text, fontSize: 72, fontWeight: 700 }}>MajorStockX</span>
      </div>
      <p style={{ color: C.blue, fontSize: 58, fontWeight: 700, marginTop: 40, ...fade(36) }}>stock.majorgroup.app</p>
      <p style={{ color: C.muted, fontSize: 46, marginTop: 14, ...fade(44) }}>Experimente grátis</p>
    </AbsoluteFill>
  );
};
