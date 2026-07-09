import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Printer, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { TitleSearchResult } from "@/lib/foreclosure/foreclosure.functions";

const HPD_COLORS: Record<string, string> = {
  A: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  B: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  C: "bg-red-500/10 text-red-700 border-red-500/30",
};

function renderStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("paid") || s.includes("closed") || s.includes("cancel")) {
    return <Badge className="bg-green-500/10 text-green-700 border-green-500/30">{status}</Badge>;
  }
  if (s.includes("open") || s.includes("active")) {
    return <Badge className="bg-red-500/10 text-red-700 border-red-500/30">{status}</Badge>;
  }
  return <Badge variant="outline">{status || "—"}</Badge>;
}

function marketableBadge(m: string) {
  const v = (m || "Unknown").toLowerCase();
  if (v === "yes") return (
    <Badge className="bg-green-500/10 text-green-700 border-green-500/30 gap-1"><CheckCircle2 className="w-3 h-3" />Marketable: Yes</Badge>
  );
  if (v === "no") return (
    <Badge className="bg-red-500/10 text-red-700 border-red-500/30 gap-1"><XCircle className="w-3 h-3" />Marketable: No</Badge>
  );
  return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 gap-1"><HelpCircle className="w-3 h-3" />Marketable: Unknown</Badge>;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-4 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function TitleSearchPanel({
  result,
  onPrint,
}: {
  result: TitleSearchResult;
  onPrint?: () => void;
}) {
  const taxDelinquent = (result.taxStatus || "").toLowerCase().includes("delinq");

  return (
    <div className="space-y-5" data-title-search-panel>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground">Preliminary Title Search</div>
          <div className="text-lg font-semibold">{result.address}</div>
          <div className="text-xs text-muted-foreground">Searched: {result.searchDate || "—"}</div>
        </div>
        {onPrint && (
          <Button size="sm" variant="outline" onClick={onPrint} className="print:hidden">
            <Printer className="w-4 h-4 mr-1.5" />
            Print Report
          </Button>
        )}
      </div>

      <Section title="1. Ownership">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Owner of Record" value={result.ownerOfRecord} />
          <Field label="Owner Since" value={result.ownerSince} />
          <Field label="Deed Type" value={result.deedType} />
          <Field label="Purchase Price" value={result.purchasePrice} />
          <Field label="Legal Description" value={result.legalDescription} />
        </div>
      </Section>

      <Section title="2. Encumbrances">
        <div>
          <div className="text-xs font-medium mb-2">Open Mortgages ({result.openMortgages.length})</div>
          {result.openMortgages.length === 0 ? (
            <div className="text-xs text-muted-foreground">None found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.openMortgages.map((m, i) => (
                <div key={i} className="border rounded p-3 text-sm space-y-1">
                  <div className="font-medium">{m.lender || "Unknown lender"}</div>
                  <div className="text-muted-foreground text-xs">Amount: {m.amount || "—"}</div>
                  <div className="text-muted-foreground text-xs">Date: {m.date || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium mb-2">Tax Liens ({result.taxLiens.length})</div>
          {result.taxLiens.length === 0 ? (
            <div className="text-xs text-muted-foreground">None found.</div>
          ) : (
            <div className="space-y-1.5">
              {result.taxLiens.map((l, i) => (
                <div key={i} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{l.amount || "—"}</span>
                    <span className="text-muted-foreground text-xs ml-2">{l.year}</span>
                  </div>
                  {renderStatusBadge(l.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium mb-2">Judgments ({result.judgments.length})</div>
          {result.judgments.length === 0 ? (
            <div className="text-xs text-muted-foreground">None found.</div>
          ) : (
            <div className="space-y-1.5">
              {result.judgments.map((j, i) => (
                <div key={i} className="border rounded px-3 py-2 text-sm">
                  <div className="font-medium">{j.creditor || "Unknown creditor"}</div>
                  <div className="text-xs text-muted-foreground">{j.amount} · {j.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium mb-2">Mechanics Liens ({result.mechanicsLiens.length})</div>
          {result.mechanicsLiens.length === 0 ? (
            <div className="text-xs text-muted-foreground">None found.</div>
          ) : (
            <div className="space-y-1.5">
              {result.mechanicsLiens.map((m, i) => (
                <div key={i} className="border rounded px-3 py-2 text-sm">
                  <div className="font-medium">{m.claimant || "Unknown claimant"}</div>
                  <div className="text-xs text-muted-foreground">{m.amount} · {m.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="3. Legal">
        <div>
          <div className="text-xs font-medium mb-2">Lis Pendens ({result.lisPendens.length})</div>
          {result.lisPendens.length === 0 ? (
            <div className="text-xs text-muted-foreground">None found.</div>
          ) : (
            <div className="space-y-1.5">
              {result.lisPendens.map((lp, i) => (
                <div key={i} className="border rounded px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">Case #{lp.caseNo || "—"}</div>
                    {renderStatusBadge(lp.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">{lp.plaintiff} · {lp.filedDate}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium mb-2">HPD Violations ({result.hpdViolations.length})</div>
          {result.hpdViolations.length === 0 ? (
            <div className="text-xs text-muted-foreground">None found.</div>
          ) : (
            <div className="space-y-1.5">
              {result.hpdViolations.map((v, i) => (
                <div key={i} className="border rounded px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={HPD_COLORS[v.class?.toUpperCase()] ?? "bg-muted"}>
                        Class {v.class || "—"}
                      </Badge>
                      <span className="text-sm">{v.description || "—"}</span>
                    </div>
                    {renderStatusBadge(v.status)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Issued: {v.date || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="4. Tax Status">
        <div className="flex flex-wrap items-center gap-2">
          {taxDelinquent ? (
            <Badge className="bg-red-500/10 text-red-700 border-red-500/30">Delinquent</Badge>
          ) : (
            <Badge className="bg-green-500/10 text-green-700 border-green-500/30">{result.taxStatus || "Current"}</Badge>
          )}
          {result.taxDelinquencyAmount && (
            <span className="text-sm text-muted-foreground">Amount owed: {result.taxDelinquencyAmount}</span>
          )}
        </div>
      </Section>

      <Section title="5. Title Risk Assessment">
        <div className="flex flex-wrap gap-2">{marketableBadge(result.marketableTitle)}</div>
        {result.redFlags.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium">Red Flags</div>
            {result.redFlags.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm border border-amber-500/30 bg-amber-500/10 text-amber-700 rounded px-3 py-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        )}
        {result.recommendation && (
          <div className="border-l-4 border-primary bg-primary/5 rounded p-3 text-sm">
            <div className="text-xs font-medium text-primary mb-1">Recommendation</div>
            {result.recommendation}
          </div>
        )}
      </Section>

      <p className="text-xs text-muted-foreground border-t pt-3">
        Preliminary automated title search — not a substitute for a certified title insurance report.
      </p>
    </div>
  );
}

export function printTitleSearch(result: TitleSearchResult) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]!);
  const row = (label: string, val: unknown) =>
    `<tr><td class="lbl">${label}</td><td>${esc(val) || "—"}</td></tr>`;
  const listBlock = <T,>(title: string, items: T[], render: (t: T) => string) =>
    `<h3>${title} (${items.length})</h3>` +
    (items.length === 0 ? `<p class="muted">None found.</p>` : `<ul>${items.map((i) => `<li>${render(i)}</li>`).join("")}</ul>`);

  w.document.write(`<!doctype html><html><head><title>Title Search — ${esc(result.address)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#111; padding:32px; max-width:820px; margin:auto; }
  header { display:flex; justify-content:space-between; border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:20px; }
  h1 { font-size:20px; margin:0; }
  h2 { font-size:14px; margin-top:24px; text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid #999; padding-bottom:4px;}
  h3 { font-size:12px; margin:14px 0 6px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  td { padding:4px 6px; vertical-align:top; }
  .lbl { color:#666; width:180px; }
  ul { padding-left:18px; font-size:13px; }
  .muted { color:#888; font-size:12px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; margin-right:6px; }
  .brand { font-weight:700; letter-spacing:.05em; }
  .footer { margin-top:32px; font-size:11px; color:#777; border-top:1px solid #ddd; padding-top:8px; }
  @media print { body { padding:0; } }
</style></head><body>
<header>
  <div>
    <div class="brand">PropAI · Preliminary Title Search</div>
    <div class="muted">${esc(result.searchDate)}</div>
  </div>
  <div class="muted">AI Network Agency</div>
</header>
<h1>${esc(result.address)}</h1>

<h2>1. Ownership</h2>
<table>
  ${row("Owner of Record", result.ownerOfRecord)}
  ${row("Owner Since", result.ownerSince)}
  ${row("Deed Type", result.deedType)}
  ${row("Purchase Price", result.purchasePrice)}
  ${row("Legal Description", result.legalDescription)}
</table>

<h2>2. Encumbrances</h2>
${listBlock("Open Mortgages", result.openMortgages, (m) => `<b>${esc(m.lender)}</b> — ${esc(m.amount)} (${esc(m.date)})`)}
${listBlock("Tax Liens", result.taxLiens, (l) => `${esc(l.amount)} · ${esc(l.year)} — ${esc(l.status)}`)}
${listBlock("Judgments", result.judgments, (j) => `<b>${esc(j.creditor)}</b> — ${esc(j.amount)} (${esc(j.date)})`)}
${listBlock("Mechanics Liens", result.mechanicsLiens, (m) => `<b>${esc(m.claimant)}</b> — ${esc(m.amount)} (${esc(m.date)})`)}

<h2>3. Legal</h2>
${listBlock("Lis Pendens", result.lisPendens, (lp) => `Case #${esc(lp.caseNo)} — ${esc(lp.plaintiff)} (${esc(lp.filedDate)}) — ${esc(lp.status)}`)}
${listBlock("HPD Violations", result.hpdViolations, (v) => `Class ${esc(v.class)} — ${esc(v.description)} — ${esc(v.status)} (${esc(v.date)})`)}

<h2>4. Tax Status</h2>
<table>
  ${row("Status", result.taxStatus)}
  ${row("Delinquency Amount", result.taxDelinquencyAmount)}
</table>

<h2>5. Title Risk Assessment</h2>
<table>${row("Marketable Title", result.marketableTitle)}</table>
${result.redFlags.length ? `<h3>Red Flags</h3><ul>${result.redFlags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
${result.recommendation ? `<h3>Recommendation</h3><p>${esc(result.recommendation)}</p>` : ""}

<div class="footer">
  Preliminary automated title search generated by PropAI. This is not a substitute for a certified title insurance report or attorney review.
</div>
<script>window.onload = () => setTimeout(() => window.print(), 250);</script>
</body></html>`);
  w.document.close();
}
