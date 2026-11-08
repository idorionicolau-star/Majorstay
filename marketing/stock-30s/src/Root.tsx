import { Composition, Folder } from "remotion";
import { StockEm30s } from "./Video";
import { Entrada, Intro, Inventario, Outro, Variacoes } from "./Scenes";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="StockEm30s" component={StockEm30s} durationInFrames={900} fps={30} width={1080} height={1920} />
      <Folder name="Cenas">
        <Composition id="Abertura" component={Intro} durationInFrames={75} fps={30} width={1080} height={1920} />
        <Composition id="Entrada" component={Entrada} durationInFrames={240} fps={30} width={1080} height={1920} />
        <Composition id="Variacoes" component={Variacoes} durationInFrames={300} fps={30} width={1080} height={1920} />
        <Composition id="Inventario" component={Inventario} durationInFrames={190} fps={30} width={1080} height={1920} />
        <Composition id="Fecho" component={Outro} durationInFrames={135} fps={30} width={1080} height={1920} />
      </Folder>
    </>
  );
};
