import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Space Grotesk (a letra da MajorStockX), guardada no projecto: o render não depende da internet.
export const fontFamily = "Space Grotesk";
loadFont({ family: fontFamily, url: staticFile("SpaceGrotesk.woff2"), weight: "300 700" });

export const C = {
  bg: "#0b1220",
  card: "#111a2e",
  blue: "#3b82f6",
  green: "#10b981",
  text: "#f8fafc",
  muted: "#94a3b8",
};
