import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, fontFamily } from "./theme";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = (a: number) => ({ opacity: interpolate(frame, [a, a + 12], [0, 1], { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }) });
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, alignItems: "center", justifyContent: "center", padding: 100, textAlign: "center" }}>
      <h1 style={{ color: C.text, fontSize: 96, fontWeight: 700, lineHeight: 1.1, ...fade(0) }}>
        Venda registada.<br /><span style={{ color: C.green }}>Stock actualizado.</span>
      </h1>
      <p style={{ color: C.muted, fontSize: 48, marginTop: 30, ...fade(12) }}>Factura, recibo ou guia prontos a enviar.</p>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 110, ...fade(28) }}>
        <Img src={staticFile("logo.png")} style={{ width: 120, height: 120, borderRadius: 28 }} />
        <span style={{ color: C.text, fontSize: 72, fontWeight: 700 }}>MajorStockX</span>
      </div>
      <p style={{ color: C.blue, fontSize: 58, fontWeight: 700, marginTop: 40, ...fade(36) }}>stock.majorgroup.app</p>
      <p style={{ color: C.muted, fontSize: 46, marginTop: 14, ...fade(44) }}>Experimente grátis</p>
    </AbsoluteFill>
  );
};
