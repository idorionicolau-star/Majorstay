import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, fontFamily } from "./theme";

// Capturas reais da app (390 x 844 px no telemóvel), mostradas num telemóvel de PHONE_W de largura.
const PHONE_W = 620;
const SCALE = PHONE_W / 390;
const PHONE_H = 844 * SCALE;
const PHONE_TOP = 520;

export type Shot = { from: number; file: string; caption: string };
export type Tap = { at: number; x: number; y: number };
/** caixa a destacar (coordenadas do ecrã do telemóvel), visível de `from` a `to` */
export type Mark = { from: number; to: number; x: number; y: number; w: number; h: number; color?: string };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const TapDot: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x * SCALE - 50, top: y * SCALE - 50, width: 100, height: 100, borderRadius: 50, border: `8px solid ${C.blue}`, backgroundColor: "rgba(59,130,246,0.25)", scale: interpolate(f, [0, 12], [1.4, 0.8], clamp), opacity: interpolate(f, [0, 4, 14, 18], [0, 1, 1, 0], clamp) }} />
  );
};

export const PhoneScene: React.FC<{ step: number; title: string; shots: Shot[]; taps: Tap[]; marks: Mark[] }> = ({ step, title, shots, taps, marks }) => {
  const frame = useCurrentFrame();
  const current = [...shots].reverse().find((s) => frame >= s.from) ?? shots[0];
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, alignItems: "center" }}>
      {/* parte do vídeo: 1, 2, 3 */}
      <div style={{ marginTop: 110, display: "flex", alignItems: "center", gap: 22 }}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: n === step ? C.blue : n < step ? C.green : "#334155" }} />
        ))}
      </div>
      <h1 style={{ color: C.text, fontSize: 84, fontWeight: 700, marginTop: 26, textAlign: "center", opacity: interpolate(frame, [0, 10], [0, 1], clamp) }}>
        {title}
      </h1>
      <p key={current.caption} style={{ color: C.muted, fontSize: 50, fontWeight: 500, marginTop: 4, textAlign: "center", opacity: interpolate(frame - current.from, [0, 8], [0, 1], clamp) }}>
        {current.caption}
      </p>

      <div style={{ position: "absolute", top: PHONE_TOP, width: PHONE_W, height: PHONE_H, borderRadius: 64, overflow: "hidden", boxShadow: "0 0 0 14px #1e293b, 0 40px 120px rgba(0,0,0,0.6)", backgroundColor: "#fff" }}>
        {shots.map((s, i) => {
          const next = shots[i + 1];
          return (
            <Sequence key={s.file + s.from} from={s.from} durationInFrames={next ? next.from - s.from + 6 : Infinity} layout="none">
              <Img src={staticFile(s.file)} style={{ position: "absolute", inset: 0, width: PHONE_W, height: PHONE_H, opacity: interpolate(frame - s.from, [0, 6], [0, 1], clamp) }} />
            </Sequence>
          );
        })}
        {marks.map((m, i) => (
          <div key={`m${i}`} style={{ position: "absolute", left: m.x * SCALE, top: m.y * SCALE, width: m.w * SCALE, height: m.h * SCALE, borderRadius: 14 * SCALE, border: `6px solid ${m.color ?? C.green}`, opacity: interpolate(frame, [m.from, m.from + 8, m.to - 6, m.to], [0, 1, 1, 0], clamp) }} />
        ))}
        {taps.map((t, i) => (
          <Sequence key={`t${i}`} from={t.at} durationInFrames={20} layout="none">
            <TapDot x={t.x} y={t.y} />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};
