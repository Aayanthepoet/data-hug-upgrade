import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getPropertyDetail, type TimelineEvent } from "@/lib/distress/detail.functions";
import { ExternalLink, ArrowLeft, Search, X } from "lucide-react";

const KIND_META: Record<TimelineEvent["kind"], { label: string; color: string }> = {
  deed: { label: "Deed", color: "#06b6d4" },
  foreclosure: { label: "Foreclosure deed", color: "#ef4444" },
  mortgage: { label: "Mortgage", color: "#a855f7" },
  assignment: { label: "Mortgage assigned", color: "#8b5cf6" },
  satisfaction: { label: "Mortgage satisfied", color: "#22c55e" },
  lis_pendens: { label: "Lis pendens", color: "#f97316" },
  other: { label: "Other", color: "#64748b" },
};

export const Route = createFileRoute("/_authenticated/app/properties/$propertyId")({
  head: () => ({ meta: [{ title: "Property detail — PropAI" }] }),
  component: PropertyDetailPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">Couldn't load property</h1>
        <p className="text-sm text-[var(--w55)]">{error.message}</p>
        <button
          className="text-cyan text-sm"
          onClick={() => { reset(); router.invalidate(); }}
        >Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Property not found.</div>,
});

function PropertyDetailPage() {
  const { propertyId } = Route.useParams();
  const fetchDetail = useServerFn(getPropertyDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["property-detail", propertyId],
    queryFn: () => fetchDetail({ data: { propertyId } }),
  });

  if (isLoading) return <div className="text-[var(--w55)]">Loading live records…</div>;
  if (error) return <div className="text-red-400">{(error as Error).message}</div>;
  if (!data) return null;

  const p = data.property;
  const providerLabel =
    p.source_provider === "nyc_opendata" ? "NYC Open Data"
    : p.source_provider === "philly_carto" ? "Philadelphia Carto"
    : p.source_provider === "mock" ? "Sample data"
    : (p.source_provider ?? "Unknown");

  return (
    <div className="space-y-6">
      <Link to="/app/properties" className="inline-flex items-center gap-1 text-xs text-[var(--w55)] hover:text-white">
        <ArrowLeft className="h-3 w-3" /> Back to properties
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Live · {providerLabel}
          </span>
          {p.distress_type && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {p.distress_type.replace("_", " ")}
            </span>
          )}
          {typeof p.lead_score === "number" && (
            <span className="text-xs text-[var(--w55)]">Lead score {p.lead_score}/100</span>
          )}
        </div>
        <h1 className="text-3xl font-bold">{p.address}</h1>
        <p className="text-[var(--w55)]">
          {[p.city, p.state, p.zip].filter(Boolean).join(", ")} · {p.county}
        </p>
      </header>

      {/* Quick stats from our stored row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Est. value" value={p.estimated_value ? `$${Number(p.estimated_value).toLocaleString()}` : "—"} />
        <Stat label="Equity" value={p.equity ? `$${Number(p.equity).toLocaleString()}` : "—"} />
        <Stat label="List price" value={p.list_price ? `$${Number(p.list_price).toLocaleString()}` : "—"} />
        <Stat label="Tax owed" value={p.tax_owed ? `$${Number(p.tax_owed).toLocaleString()}` : "—"} />
        <Stat label="Beds / baths" value={`${p.beds ?? "—"} / ${p.baths ?? "—"}`} />
        <Stat label="Sq ft" value={p.sqft ? Number(p.sqft).toLocaleString() : "—"} />
        <Stat label="Year built" value={p.year_built ?? "—"} />
        <Stat label="Days on market" value={p.days_on_market ?? "—"} />
      </section>

      {data.groups.length === 0 && (
        <div className="border border-border rounded-lg p-6 text-sm text-[var(--w55)]">
          No live source records returned for this property. This typically means the source
          identifier (BBL or parcel #) wasn't preserved at import time, or this property came
          from sample data.
        </div>
      )}

      {data.groups.map((g, gi) => (
        <section key={gi} className="border border-border rounded-lg">
          <header className="flex items-start justify-between gap-3 p-4 border-b border-border">
            <div>
              <h2 className="font-medium">{g.title}</h2>
              <p className="text-[11px] uppercase tracking-wider text-[var(--w55)] mt-1">
                Source: {g.source}
              </p>
            </div>
            <a
              href={g.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan inline-flex items-center gap-1 shrink-0"
            >
              Dataset <ExternalLink className="h-3 w-3" />
            </a>
          </header>

          {g.facts.length > 0 && (
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 p-4 text-sm">
              {g.facts.filter((f) => f.value != null && f.value !== "").map((f) => (
                <div key={f.label} className="flex justify-between border-b border-border/30 py-1">
                  <dt className="text-[var(--w55)]">{f.label}</dt>
                  <dd className="text-right">{String(f.value)}</dd>
                </div>
              ))}
            </dl>
          )}

          {g.timeline && g.timeline.length > 0 && (
            <div className="p-4 border-t border-border">
              <h3 className="text-xs uppercase tracking-wider text-[var(--w55)] mb-3">Timeline</h3>
              <ol className="relative border-l border-border/60 ml-2 space-y-4">
                {g.timeline.map((e, ei) => {
                  const meta = KIND_META[e.kind];
                  return (
                    <li key={ei} className="pl-5 relative">
                      <span
                        className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-2 ring-background"
                        style={{ background: meta.color }}
                      />
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <time className="text-xs font-mono text-[var(--w55)]">{e.date}</time>
                        <span
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                          style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}15` }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-sm font-medium">{e.title}</span>
                        {e.amount != null && e.amount > 0 && (
                          <span className="text-sm text-cyan">${e.amount.toLocaleString()}</span>
                        )}
                      </div>
                      {(e.from || e.to) && (
                        <p className="text-xs text-[var(--w55)] mt-0.5">
                          {e.from ?? "—"} <span className="opacity-60">→</span> {e.to ?? "—"}
                        </p>
                      )}
                      {e.docId && (
                        <p className="text-[10px] font-mono text-[var(--w55)] mt-0.5">Doc {e.docId}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {g.rows && g.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[rgba(255,255,255,.03)] text-left uppercase tracking-wider text-[var(--w55)]">
                  <tr>
                    {Object.keys(g.rows[0]).map((k) => (
                      <th key={k} className="px-4 py-2 font-normal">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-border">
                      {Object.keys(g.rows![0]).map((k) => (
                        <td key={k} className="px-4 py-2">{row[k] == null ? "—" : String(row[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-border rounded-md p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--w55)]">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}
