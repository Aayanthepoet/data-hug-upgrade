import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { loadFont as loadDisplay } from "@remotion/google-fonts/Outfit";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { SceneHook } from "./scenes/SceneHook";
import { SceneThreads } from "./scenes/SceneThreads";
import { SceneTasks } from "./scenes/SceneTasks";
import { ScenePersist } from "./scenes/ScenePersist";
import { SceneOutro } from "./scenes/SceneOutro";

const display = loadDisplay("normal", { weights: ["600", "800"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const fonts = { display: display.fontFamily, body: body.fontFamily };

export const palette = {
  bg: "#0B0F1A",
  bg2: "#131A2C",
  ink: "#F4F1EA",
  muted: "#8B93A7",
  accent: "#FF6A3D",
  accent2: "#7C5CFF",
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 30;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at ${20 + Math.sin(t * 0.4) * 10}% ${30 + Math.cos(t * 0.3) * 10}%, ${palette.accent2}22, transparent 60%), radial-gradient(900px 700px at ${80 + Math.cos(t * 0.5) * 8}% ${70 + Math.sin(t * 0.4) * 8}%, ${palette.accent}22, transparent 60%), linear-gradient(180deg, ${palette.bg} 0%, ${palette.bg2} 100%)`,
      }}
    >
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.06 }}>
        <defs>
          <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke={palette.ink} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: fonts.body, color: palette.ink }}>
      <Background />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })} />
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneThreads />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 24 })} />
        <TransitionSeries.Sequence durationInFrames={130}>
          <SceneTasks />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 24 })} />
        <TransitionSeries.Sequence durationInFrames={110}>
          <ScenePersist />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })} />
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
