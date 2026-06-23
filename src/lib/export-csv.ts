import type { UIMessage } from "ai";

function extractText(m: UIMessage): string {
  return m.parts
    .map((p) => {
      if (p.type === "text") return p.text;
      if (typeof p.type === "string" && p.type.startsWith("tool-")) {
        const tp = p as { output?: unknown };
        if (tp.output == null) return "";
        if (typeof tp.output === "string") return `[Tool result] ${tp.output}`;
        try {
          return `[Tool result] ${JSON.stringify(tp.output)}`;
        } catch {
          return "";
        }
      }
      if (p.type === "file") {
        const fp = p as { filename?: string; mediaType?: string };
        return `[Attachment ${fp.filename ?? fp.mediaType ?? "file"}]`;
      }
      return "";
    })
    .join(" ")
    .trim();
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportConversationToCsv(
  messages: UIMessage[],
  filename = "propai-transcript.csv",
) {
  const header = ["index", "role", "content"];
  const rows = messages.map((m, i) => [
    String(i + 1),
    m.role,
    extractText(m),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
