import { Composition, Folder } from "remotion";
import { VendaEm10s } from "./Video";
import { Intro } from "./Intro";
import { Sale } from "./Sale";
import { Outro } from "./Outro";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="VendaEm10s" component={VendaEm10s} durationInFrames={450} fps={30} width={1080} height={1920} />
      <Folder name="Cenas">
        <Composition id="Abertura" component={Intro} durationInFrames={60} fps={30} width={1080} height={1920} />
        <Composition id="Venda" component={Sale} durationInFrames={300} fps={30} width={1080} height={1920} />
        <Composition id="Fecho" component={Outro} durationInFrames={110} fps={30} width={1080} height={1920} />
      </Folder>
    </>
  );
};
