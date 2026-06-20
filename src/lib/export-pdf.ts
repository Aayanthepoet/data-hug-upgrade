import { jsPDF } from "jspdf";
import type { UIMessage } from "ai";

function extractText(m: UIMessage): string {
  return m.parts
    .map((p) => {
      if (p.type === "text") return p.text;
      if (typeof p.type === "string" && p.type.startsWith("tool-")) {
        const tp = p as { output?: unknown };
        if (tp.output == null) return "";
        if (typeof tp.output === "string") return `\n[Tool result]\n${tp.output}`;
        try {
          return `\n[Tool result]\n${JSON.stringify(tp.output, null, 2)}`;
        } catch {
          return "";
        }
      }
      return "";
    })
    .join("")
    .trim();
}

export function exportConversationToPdf(messages: UIMessage[], filename = "propai-report.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PropAI Lead Report", margin, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 20;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 18;
  doc.setTextColor(20);

  if (messages.length === 0) {
    doc.setFontSize(12);
    doc.text("No conversation to export yet.", margin, y);
  }

  for (const m of messages) {
    const text = extractText(m);
    if (!text) continue;
    const label = m.role === "user" ? "You asked" : "PropAI Agent";

    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(m.role === "user" ? 80 : 20);
    doc.text(label, margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 10;
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 20, { align: "right" });
  }

  doc.save(filename);
}
