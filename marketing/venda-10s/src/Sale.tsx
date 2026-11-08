import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontFamily } from "./theme";

// Capturas reais da Venda Rápida (390 x 844 px no telemóvel). O telemóvel no vídeo tem PHONE_W de largura.
const PHONE_W = 620;
const SCALE = PHONE_W / 390;
const PHONE_H = 844 * SCALE;
const PHONE_TOP = 470;

// quando muda cada ecrã (frames a 30 fps) e o toque que leva ao seguinte (coordenadas no ecrã do telemóvel)
const SHOTS = [
  { from: 0, file: "1-inicio.png", caption: "Escreva o produto", tap: { at: 38, x: 130, y: 181 } },
  { from: 60, file: "2-pesquisa.png", caption: "Toque — já está no carrinho", tap: { at: 92, x: 195, y: 243 } },
  { from: 105, file: "3-carrinho.png", caption: "10 sacos de cimento", tap: { at: 160, x: 159, y: 663 } },
  { from: 175, file: "4-mpesa.png", caption: "Pagou por M-Pesa", tap: { at: 218, x: 282, y: 748 } },
  { from: 236, file: "5-feito.png", caption: "Venda registada ✅", tap: null },
] as const;

export const CONFIRM_FRAME = 236;

const Tap: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x * SCALE - 50, top: y * SCALE - 50, width: 100, height: 100, borderRadius: 50, border: `8px solid ${C.blue}`, backgroundColor: "rgba(59,130,246,0.25)", scale: interpolate(f, [0, 12], [1.4, 0.8], { extrapolateRight: "clamp" }), opacity: interpolate(f, [0, 4, 14, 18], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
  );
};

export const Sale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = Math.min(frame, CONFIRM_FRAME) / fps;
  const done = frame >= CONFIRM_FRAME;
  const found = [...SHOTS].reverse().find((s) => frame >= s.from)!;
  // um segundo depois de confirmar: mostra que o stock desceu sozinho
  const stockStep = frame >= CONFIRM_FRAME + 30;
  const current = stockStep ? { caption: "Stock: 240 → 230 sacos", from: CONFIRM_FRAME + 30 } : found;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, alignItems: "center" }}>
      {/* cronómetro */}
      <div style={{ marginTop: 110, display: "flex", alignItems: "baseline", gap: 18, color: done ? C.green : C.text, fontSize: 150, fontWeight: 700, fontVariantNumeric: "tabular-nums", scale: done ? interpolate(frame, [CONFIRM_FRAME, CONFIRM_FRAME + 8], [1.15, 1], { extrapolateRight: "clamp" }) : 1 }}>
        {seconds.toFixed(1).replace(".", ",")}<span style={{ fontSize: 70, color: C.muted }}>s</span>
      </div>
      <p key={current.caption} style={{ color: done ? C.green : C.text, fontSize: 56, fontWeight: 500, marginTop: 6, opacity: interpolate(frame - current.from, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }}>
        {current.caption}
      </p>

      {/* telemóvel */}
      <div style={{ position: "absolute", top: PHONE_TOP, width: PHONE_W, height: PHONE_H, borderRadius: 64, overflow: "hidden", boxShadow: `0 0 0 14px #1e293b, 0 40px 120px rgba(0,0,0,0.6)`, backgroundColor: "#fff" }}>
        {SHOTS.map((s, i) => {
          const next = SHOTS[i + 1];
          return (
            <Sequence key={s.file} from={s.from} durationInFrames={next ? next.from - s.from + 6 : Infinity} layout="none">
              <Img src={staticFile(s.file)} style={{ position: "absolute", inset: 0, width: PHONE_W, height: PHONE_H, opacity: interpolate(frame - s.from, [0, 6], [0, 1], { extrapolateRight: "clamp" }) }} />
            </Sequence>
          );
        })}
        {SHOTS.map((s) => s.tap && (
          <Sequence key={`tap-${s.file}`} from={s.tap.at} durationInFrames={20} layout="none">
            <Tap x={s.tap.x} y={s.tap.y} />
          </Sequence>
        ))}
        {/* depois de confirmar: destaca a venda registada e o stock que desceu (240 → 230) */}
        {stockStep && (
          <div style={{ position: "absolute", left: 11 * SCALE, top: 298 * SCALE, width: 245 * SCALE, height: 41 * SCALE, borderRadius: 22 * SCALE, border: `6px solid ${C.green}`, opacity: interpolate(frame, [CONFIRM_FRAME + 30, CONFIRM_FRAME + 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
        )}
        {done && !stockStep && (
          <div style={{ position: "absolute", left: 10 * SCALE, top: 148 * SCALE, width: 370 * SCALE, height: 44 * SCALE, borderRadius: 18 * SCALE, border: `6px solid ${C.green}`, opacity: interpolate(frame, [CONFIRM_FRAME + 6, CONFIRM_FRAME + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
        )}
      </div>
    </AbsoluteFill>
  );
};
