import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { fonts, palette } from "../MainVideo";

const threads = [
  "Q4 launch plan",
  "Refactor auth flow",
  "Pricing experiments",
  "Hiring scorecard",
  "Customer interview notes",
];

export const SceneThreads: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headline = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ flexDirection: "row", padding: "100px 140px", gap: 80, alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 110, lineHeight: 1.02, letterSpacing: -2, opacity: headline, transform: `translateX(${(1 - headline) * -40}px)` }}>
          One mind.<br />
          <span style={{ color: palette.accent2 }}>Many threads.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: palette.muted, maxWidth: 600 }}>
          Keep every conversation organized. Pick up exactly where you left off.
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        {threads.map((t, i) => {
          const s = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 18 } });
          const active = i === 1;
          return (
            <div
              key={t}
              style={{
                opacity: s,
                transform: `translateX(${(1 - s) * 40}px)`,
                background: active ? `${palette.accent2}22` : "#ffffff08",
                border: `1px solid ${active ? palette.accent2 : "#ffffff14"}`,
                borderRadius: 16,
                padding: "22px 28px",
                fontSize: 28,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 99, background: active ? palette.accent : palette.muted }} />
              {t}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
