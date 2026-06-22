import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { getPropertyDetail, type TimelineEvent } from "@/lib/distress/detail.functions";
import { upsertWatchlistItem } from "@/lib/watchlist.functions";
import { ExternalLink, ArrowLeft, Search, X, Link2, Check, QrCode, Bookmark, BookmarkCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  event: fallback(z.string(), "").default(""),
});

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
  validateSearch: zodValidator(searchSchema),
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
            <TimelineSection events={g.timeline} address={p.address} />
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

function eventKey(e: TimelineEvent, idx: number): string {
  return e.docId ?? `${e.date}-${idx}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function dateRange(events: { date: string }[]): string {
  if (events.length === 0) return "";
  const dates = events.map((e) => e.date).filter(Boolean).sort();
  if (dates.length === 0) return "";
  const a = dates[0].slice(0, 4);
  const b = dates[dates.length - 1].slice(0, 4);
  return a === b ? a : `${a}-${b}`;
}

function buildShareTitle(
  address: string,
  filteredEvents: TimelineEvent[],
  selected: TimelineEvent | null,
): string {
  const range = dateRange(filteredEvents);
  const parts = [address];
  if (range) parts.push(range);
  if (selected) {
    const meta = KIND_META[selected.kind];
    parts.push(`${meta.label} ${selected.date}`);
  }
  return parts.join(" · ");
}

function TimelineSection({ events, address }: { events: TimelineEvent[]; address: string }) {
  const { q, event: selectedKey } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  // Debounce URL updates while typing so each keystroke doesn't push history
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    const id = setTimeout(() => {
      if (draft !== q) {
        navigate({
          search: (prev: { q: string; event: string }) => ({ ...prev, q: draft }),
          replace: true,
          resetScroll: false,
        });
      }
    }, 200);
    return () => clearTimeout(id);
  }, [draft, q, navigate]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const indexed = events.map((e, idx) => ({ e, key: eventKey(e, idx) }));
    if (!term) return indexed;
    return indexed.filter(({ e }) =>
      [e.from, e.to, e.docId, e.date, e.title, KIND_META[e.kind].label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [events, q]);

  const selectedEvent = useMemo(() => {
    if (!selectedKey) return null;
    return filtered.find(({ key }) => key === selectedKey)?.e
      ?? events.find((e, i) => eventKey(e, i) === selectedKey)
      ?? null;
  }, [selectedKey, filtered, events]);

  const shareTitle = useMemo(
    () => buildShareTitle(address, filtered.map((f) => f.e), selectedEvent),
    [address, filtered, selectedEvent],
  );

  // Reflect the human-readable view title in the browser tab too
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.title;
    document.title = `${shareTitle} — PropAI`;
    return () => { document.title = prev; };
  }, [shareTitle]);

  const selectedRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (selectedKey && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedKey]);

  const [copied, setCopied] = useState<string | null>(null);
  const buildShareUrl = (key: string | null, evt: TimelineEvent | null): string => {
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("event", key);
    else url.searchParams.delete("event");
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    // Human-readable hash slug — ignored by the router, but visible to humans
    // and to link-preview crawlers that show the URL itself.
    const title = buildShareTitle(address, filtered.map((f) => f.e), evt);
    url.hash = slugify(title);
    return url.toString();
  };

  const copyShareLink = async (key: string, evt: TimelineEvent) => {
    const shareUrl = buildShareUrl(key, evt);
    const title = buildShareTitle(address, filtered.map((f) => f.e), evt);
    // Prefer native share sheet (mobile) — it shows the title in the preview card
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title, text: title, url: shareUrl });
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${title}\n${shareUrl}`);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const selectEvent = (key: string) => {
    navigate({
      search: (prev: { q: string; event: string }) => ({ ...prev, event: prev.event === key ? "" : key }),
      replace: false,
      resetScroll: false,
    });
  };

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-xs uppercase tracking-wider text-[var(--w55)]">Timeline</h3>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--w55)]" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search party, doc ID, or date…"
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-[rgba(255,255,255,.04)] border border-border rounded focus:outline-none focus:border-cyan"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--w55)] hover:text-white"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {q && (
        <p className="text-[11px] text-[var(--w55)] mb-2">
          {filtered.length} of {events.length} events match · URL updates live so you can share it
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--w55)] py-4">No events match "{q}".</p>
      ) : (
        <ol className="relative border-l border-border/60 ml-2 space-y-4">
          {filtered.map(({ e, key }) => {
            const meta = KIND_META[e.kind];
            const isSelected = selectedKey === key;
            return (
              <li
                key={key}
                ref={isSelected ? selectedRef : undefined}
                className={`pl-5 relative rounded-md transition-colors ${
                  isSelected ? "bg-cyan/5 ring-1 ring-cyan/40 -mx-2 px-2 py-2" : ""
                }`}
              >
                <span
                  className="absolute top-1.5 h-3 w-3 rounded-full ring-2 ring-background"
                  style={{ background: meta.color, left: isSelected ? "1px" : "-7px" }}
                />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => selectEvent(key)}
                    className="text-xs font-mono text-[var(--w55)] hover:text-cyan"
                    title="Select this event (updates URL)"
                  >
                    {e.date}
                  </button>
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
                  <div className="ml-auto flex items-center gap-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--w55)] hover:text-cyan transition-colors cursor-pointer"
                          title="Show QR Code for this event and filtered view"
                        >
                          <QrCode className="h-3.5 w-3.5" /> QR Code
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4 flex flex-col items-center gap-3 bg-zinc-950 border-zinc-800 text-zinc-100 shadow-xl">
                        <div className="text-center space-y-1">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--w55)]">Scan QR Code</h4>
                          <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">
                            {e.title} ({e.date})
                          </p>
                        </div>
                        <div className="p-2 bg-white rounded-lg shadow-inner">
                          <QRCodeSVG
                            value={buildShareUrl(key, e)}
                            size={160}
                            bgColor={"#ffffff"}
                            fgColor={"#000000"}
                            level={"M"}
                            includeMargin={false}
                          />
                        </div>
                        <p className="text-[9px] text-center text-zinc-500 leading-normal">
                          Scan to instantly load this filtered timeline event on another device.
                        </p>
                      </PopoverContent>
                    </Popover>

                    <button
                      type="button"
                      onClick={() => copyShareLink(key, e)}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--w55)] hover:text-cyan transition-colors"
                      title="Copy shareable link to this event"
                    >
                      {copied === key ? (
                        <><Check className="h-3 w-3" /> Copied</>
                      ) : (
                        <><Link2 className="h-3 w-3" /> Share</>
                      )}
                    </button>
                  </div>
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
      )}
    </div>
  );
}
