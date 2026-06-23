import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { fonts, palette } from "../MainVideo";

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14 } });
  const s2 = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const drift = Math.sin(frame / 20) * 6;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ transform: `scale(${0.6 + s * 0.4}) translateY(${drift}px)`, opacity: s }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 220, letterSpacing: -6, lineHeight: 1 }}>
          Start a <span style={{ color: palette.accent }}>thread.</span>
        </div>
      </div>
      <div style={{ marginTop: 40, fontSize: 32, color: palette.muted, opacity: s2 }}>
        Your AI copilot is one click away.
      </div>
    </AbsoluteFill>
  );
};
