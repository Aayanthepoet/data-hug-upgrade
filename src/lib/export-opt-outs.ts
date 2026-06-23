import { jsPDF } from "jspdf";

export type OptOutExportRow = {
  phone: string;
  keyword: string | null;
  reason: string | null;
  source: string;
  notes: string | null;
  opted_out_at: string;
  restored_at: string | null;
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportOptOutsCsv(rows: OptOutExportRow[], filename = "sms-opt-outs.csv") {
  const header = [
    "phone",
    "status",
    "keyword",
    "source",
    "opted_out_at",
    "restored_at",
    "reason",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.phone,
        r.restored_at ? "restored" : "blocked",
        r.keyword,
        r.source,
        r.opted_out_at,
        r.restored_at ?? "",
        r.reason,
        r.notes,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
}

export type TrendSeriesPoint = { day: string; label: string; count: number };
export type KeywordCount = { keyword: string; count: number };

export function exportTrendsCsv(
  series: TrendSeriesPoint[],
  byKeyword: KeywordCount[],
  filename = "sms-opt-out-trends.csv",
) {
  const lines: string[] = [];
  lines.push("# SMS Opt-Out Trends");
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Daily counts");
  lines.push("date,count");
  for (const p of series) lines.push(`${csvEscape(p.day)},${p.count}`);
  lines.push("");
  lines.push("By keyword");
  lines.push("keyword,count");
  for (const k of byKeyword) lines.push(`${csvEscape(k.keyword)},${k.count}`);
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
}

// ---------------- PDF ----------------

function pdfHeader(doc: jsPDF, title: string, subtitle?: string) {
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15);
  doc.text(title, margin, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, 78);
  if (subtitle) doc.text(subtitle, margin, 92);
  doc.setDrawColor(220);
  doc.line(margin, 100, pageW - margin, 100);
  doc.setTextColor(20);
}

function pdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 48, pageH - 20, { align: "right" });
    doc.text("PropAI — SMS Compliance Report", 48, pageH - 20);
  }
}

export function exportOptOutsPdf(rows: OptOutExportRow[], filename = "sms-opt-outs.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const active = rows.filter((r) => !r.restored_at).length;
  pdfHeader(
    doc,
    "SMS Opt-Out Registry",
    `${rows.length} total records · ${active} currently blocked · ${rows.length - active} restored`,
  );

  let y = 124;
  // Column layout
  const cols = [
    { key: "phone", label: "Phone", w: 110 },
    { key: "status", label: "Status", w: 60 },
    { key: "keyword", label: "Keyword", w: 80 },
    { key: "source", label: "Source", w: 80 },
    { key: "opted_out_at", label: "Opted out", w: 100 },
    { key: "restored_at", label: "Restored", w: 90 },
  ];

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80);
    let x = margin;
    for (const c of cols) {
      doc.text(c.label, x, y);
      x += c.w;
    }
    y += 12;
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
  };

  drawHeader();

  for (const r of rows) {
    if (y > pageH - 60) {
      doc.addPage();
      y = 60;
      drawHeader();
    }
    let x = margin;
    const values: Record<string, string> = {
      phone: r.phone,
      status: r.restored_at ? "Restored" : "Blocked",
      keyword: r.keyword ?? "—",
      source: r.source,
      opted_out_at: new Date(r.opted_out_at).toLocaleString(),
      restored_at: r.restored_at ? new Date(r.restored_at).toLocaleString() : "—",
    };
    doc.setFontSize(9);
    for (const c of cols) {
      const text = values[c.key] ?? "";
      const lines = doc.splitTextToSize(text, c.w - 6) as string[];
      doc.text(lines[0] ?? "", x, y);
      x += c.w;
    }
    y += 14;
  }

  pdfFooter(doc);
  doc.save(filename);
}

export function exportTrendsPdf(
  series: TrendSeriesPoint[],
  byKeyword: KeywordCount[],
  meta: { totalDays: number; total: number; active: number; deltaPct: number },
  filename = "sms-opt-out-trends.pdf",
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();

  pdfHeader(doc, "SMS Opt-Out Trends", `Last ${meta.totalDays} days`);

  let y = 130;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Summary", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total opt-outs: ${meta.total}`, margin, y);
  y += 14;
  doc.text(`Currently blocked: ${meta.active}`, margin, y);
  y += 14;
  doc.text(`Restored: ${meta.total - meta.active}`, margin, y);
  y += 14;
  doc.text(`Week-over-week change: ${meta.deltaPct > 0 ? "+" : ""}${meta.deltaPct}%`, margin, y);
  y += 24;

  // Simple bar chart of daily counts
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Daily opt-outs", margin, y);
  y += 14;

  const chartW = pageW - margin * 2;
  const chartH = 140;
  const max = Math.max(1, ...series.map((s) => s.count));
  const barW = chartW / Math.max(series.length, 1);
  const baseY = y + chartH;

  doc.setDrawColor(220);
  doc.line(margin, baseY, margin + chartW, baseY);

  doc.setFillColor(0, 180, 200);
  for (let i = 0; i < series.length; i++) {
    const h = (series[i].count / max) * (chartH - 10);
    const x = margin + i * barW + 1;
    doc.rect(x, baseY - h, Math.max(barW - 2, 1), h, "F");
  }
  y = baseY + 14;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(series[0]?.label ?? "", margin, y);
  doc.text(series[series.length - 1]?.label ?? "", margin + chartW, y, { align: "right" });
  doc.setTextColor(20);
  y += 24;

  // Keyword breakdown table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Breakdown by keyword", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const totalKw = byKeyword.reduce((s, k) => s + k.count, 0) || 1;
  for (const k of byKeyword) {
    const pct = ((k.count / totalKw) * 100).toFixed(1);
    doc.text(`${k.keyword}`, margin, y);
    doc.text(`${k.count}  (${pct}%)`, margin + 200, y);
    y += 14;
  }

  pdfFooter(doc);
  doc.save(filename);
}
