import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { fonts, palette } from "../MainVideo";

export const ScenePersist: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 200 } });
  const b = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  const c = spring({ frame: frame - 40, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center" }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 160, lineHeight: 1, letterSpacing: -3, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
        Memory that
      </div>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 160, lineHeight: 1, letterSpacing: -3, color: palette.accent2, opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>
        sticks around.
      </div>
      <div style={{ marginTop: 40, fontSize: 32, color: palette.muted, maxWidth: 1100, opacity: c }}>
        Every chat saved securely to your account — across devices, across sessions.
      </div>
      <div style={{ marginTop: 60, display: "flex", gap: 20, opacity: c }}>
        {["Encrypted", "Per-user", "Always synced"].map((t) => (
          <div key={t} style={{ padding: "16px 24px", border: `1px solid ${palette.accent2}55`, color: palette.ink, borderRadius: 999, fontSize: 24, background: `${palette.accent2}14` }}>
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
