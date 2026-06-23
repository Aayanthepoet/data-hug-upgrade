import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { fonts, palette } from "../MainVideo";

export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s1 = spring({ frame: frame - 4, fps, config: { damping: 18 } });
  const s2 = spring({ frame: frame - 24, fps, config: { damping: 18 } });
  const s3 = spring({ frame: frame - 44, fps, config: { damping: 18 } });
  const drift = Math.sin(frame / 25) * 4;

  return (
    <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center" }}>
      <div style={{ opacity: s1, transform: `translateY(${(1 - s1) * 20}px)` }}>
        <span style={{ fontFamily: fonts.body, fontSize: 28, letterSpacing: 6, color: palette.accent, textTransform: "uppercase", fontWeight: 500 }}>
          PropAI Agent
        </span>
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 180,
          lineHeight: 1,
          marginTop: 24,
          letterSpacing: -4,
          opacity: s2,
          transform: `translateY(${(1 - s2) * 40}px) translateY(${drift}px)`,
        }}
      >
        Your AI<br />
        <span style={{ color: palette.accent }}>copilot</span>
      </div>
      <div style={{ marginTop: 36, fontSize: 36, color: palette.muted, opacity: s3, maxWidth: 1100 }}>
        Built into your workspace. Ready to think with you.
      </div>
    </AbsoluteFill>
  );
};
