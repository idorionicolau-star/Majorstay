import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontFamily } from "./theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, alignItems: "center", justifyContent: "center", padding: 100 }}>
      <Img src={staticFile("logo.png")} style={{ width: 220, height: 220, borderRadius: 48, scale: pop }} />
      <h1 style={{ color: C.text, fontSize: 120, fontWeight: 700, textAlign: "center", lineHeight: 1.05, marginTop: 70, opacity: interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: interpolate(frame, [8, 22], ["0px 40px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        Uma venda em <span style={{ color: C.blue }}>10 segundos</span>
      </h1>
      <p style={{ color: C.muted, fontSize: 52, textAlign: "center", marginTop: 30, opacity: interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        no telemóvel, com a MajorStockX
      </p>
    </AbsoluteFill>
  );
};
