import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { fonts, palette } from "../MainVideo";

const steps = [
  "Analyze the request",
  "Break it into subtasks",
  "Draft the plan",
  "Execute step by step",
];

export const SceneTasks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headline = spring({ frame, fps, config: { damping: 200 } });
  const barProg = interpolate(frame, [20, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: "100px 140px", justifyContent: "center" }}>
      <div style={{ fontFamily: fonts.body, fontSize: 26, letterSpacing: 5, color: palette.accent, textTransform: "uppercase", opacity: headline, fontWeight: 500 }}>
        Task Mode
      </div>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 140, lineHeight: 1, letterSpacing: -3, marginTop: 16, opacity: headline, transform: `translateY(${(1 - headline) * 30}px)` }}>
        Plans, not just<br />
        <span style={{ color: palette.accent }}>replies.</span>
      </div>
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1100 }}>
        {steps.map((s, i) => {
          const sp = spring({ frame: frame - 30 - i * 12, fps, config: { damping: 18 } });
          const checked = barProg > (i + 1) / steps.length - 0.05;
          return (
            <div
              key={s}
              style={{
                opacity: sp,
                transform: `translateY(${(1 - sp) * 20}px)`,
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "20px 28px",
                background: "#ffffff08",
                border: "1px solid #ffffff14",
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: checked ? palette.accent : "transparent",
                  border: `2px solid ${checked ? palette.accent : palette.muted}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.bg,
                  fontWeight: 800,
                }}
              >
                {checked ? "✓" : ""}
              </div>
              <div style={{ fontSize: 32, fontWeight: 500, color: checked ? palette.ink : palette.muted }}>{s}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
