import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { Entrada, Intro, Inventario, Outro, Variacoes } from "./Scenes";

export const StockEm30s: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Abertura" durationInFrames={75} premountFor={fps}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Entrada" durationInFrames={240} premountFor={fps}>
        <Entrada />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Variações" durationInFrames={300} premountFor={fps}>
        <Variacoes />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Inventário" durationInFrames={190} premountFor={fps}>
        <Inventario />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Fecho" durationInFrames={135} premountFor={fps}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
