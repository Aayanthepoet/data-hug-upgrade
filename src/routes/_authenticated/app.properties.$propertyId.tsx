import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { getPropertyDetail, type TimelineEvent } from "@/lib/distress/detail.functions";
import { upsertWatchlistItem } from "@/lib/watchlist.functions";
import { createAuction } from "@/lib/auctions/auctions.functions";
import { getComps, runComps, type CompRow, type ArvEstimateRow } from "@/lib/comps/comps.functions";
import { listRenders, deleteRender, linkRenderToProperty } from "@/lib/vision/vision.functions";
import { ContractsSection } from "@/components/app/ContractsSection";
import { scoreProperty } from "@/lib/engines/scoring.functions";
import { Flame, Home, AlertTriangle, TrendingUp, ExternalLink as ExtLink2 } from "lucide-react";
import { getMarketIntel, type MarketIntelResult } from "@/lib/market-intel.functions";

import { ExternalLink, ArrowLeft, Search, X, Link2, Check, QrCode, Bookmark, BookmarkCheck, Gavel, Calculator, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">{p.address}</h1>
            <p className="text-[var(--w55)]">
              {[p.city, p.state, p.zip].filter(Boolean).join(", ")} · {p.county}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/app/vision"
              search={{ property: propertyId }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5"
              title="Generate AI redesign for this property"
            >
              <Link2 className="h-3.5 w-3.5 text-cyan" /> Redesign in Vision Studio
            </Link>
            <ListForAuctionButton propertyId={propertyId} defaultTitle={p.address} />
            <SaveToWatchlistButton
              propertyKey={propertyId}
              address={p.address}
              city={p.city ?? null}
              state={p.state ?? null}
              county={p.county ?? null}
            />
          </div>
        </div>
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
        {(p as { zoning_long_code?: string | null; zoning_code?: string | null }).zoning_long_code || (p as { zoning_code?: string | null }).zoning_code ? (
          <Stat
            label="Zoning (base)"
            value={(p as { zoning_long_code?: string | null }).zoning_long_code ?? (p as { zoning_code?: string | null }).zoning_code ?? "—"}
          />
        ) : null}
      </section>
      {(p as { zoning_code?: string | null }).zoning_code && (
        <p className="text-xs text-[var(--w55)] -mt-3">
          Zoning shows the <strong>base permitted use</strong>. Actual conversion (e.g. single-family → duplex) may require permits, variance, or ZBA approval — verify with the Philadelphia Department of Licenses &amp; Inspections.
        </p>
      )}

      <DistressSignals
        isVacant={p.is_vacant}
        isAbsentee={p.is_absentee}
        isPreforeclosure={p.is_preforeclosure}
        auctionDate={p.auction_date}
        lienAmount={p.lien_amount ? Number(p.lien_amount) : null}
        taxOwed={p.tax_owed ? Number(p.tax_owed) : null}
        daysOnMarket={p.days_on_market}
      />

      <AiLeadScoreSection
        propertyId={propertyId}
        leadScore={p.lead_score ?? null}
        notes={p.notes ?? null}
      />

      <CompsSection propertyId={propertyId} subjectSqft={p.sqft ?? null} />

      <MarketIntelSection propertyId={propertyId} />

      <VisionGallerySection propertyId={propertyId} />


      <ContractsSection
        propertyId={propertyId}
        defaultSeller={[p.address, p.city, p.state].filter(Boolean).join(", ")}
        defaultPrice={
          p.estimated_value != null
            ? Number(p.estimated_value)
            : p.list_price != null
              ? Number(p.list_price)
              : null
        }
      />





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

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString()}`;
}

function CompsSection({ propertyId, subjectSqft }: { propertyId: string; subjectSqft: number | null }) {
  const fetchFn = useServerFn(getComps);
  const runFn = useServerFn(runComps);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["comps", propertyId],
    queryFn: () => fetchFn({ data: { propertyId } }),
  });

  const mut = useMutation({
    mutationFn: () => runFn({ data: { propertyId } }),
    onSuccess: () => { refetch(); },
  });

  const comps: CompRow[] = data?.comps ?? [];
  const arv: ArvEstimateRow | null = data?.arv ?? null;
  const hasData = comps.length > 0 || arv != null;

  return (
    <section className="border border-border rounded-lg">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-cyan" />
          <h2 className="font-medium">Comps & ARV</h2>
          {arv && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--w55)]">
              · {arv.confidence}% confidence · {arv.comp_count} comps
            </span>
          )}
        </div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-cyan ${mut.isPending ? "animate-spin" : ""}`} />
          {mut.isPending ? "Pulling comps…" : hasData ? "Refresh comps" : "Pull comps"}
        </button>
      </header>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--w55)]">Loading…</p>
      ) : !hasData ? (
        <p className="p-4 text-sm text-[var(--w55)]">
          No comps yet. Click "Pull comps" to find recent comparable sales and estimate ARV.
        </p>
      ) : (
        <>
          {arv && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-border/60">
              <Stat label="ARV" value={fmtMoney(arv.arv)} />
              <Stat label="ARV range" value={`${fmtMoney(arv.arv_low)} — ${fmtMoney(arv.arv_high)}`} />
              <Stat label="$/sqft (median)" value={arv.price_per_sqft ? `$${arv.price_per_sqft}` : "—"} />
              <Stat label="Subject sqft" value={subjectSqft ? subjectSqft.toLocaleString() : "—"} />
            </div>
          )}
          {comps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[rgba(255,255,255,.03)] text-left uppercase tracking-wider text-[var(--w55)]">
                  <tr>
                    <th className="px-4 py-2 font-normal">Address</th>
                    <th className="px-4 py-2 font-normal">Sale price</th>
                    <th className="px-4 py-2 font-normal">$/sqft</th>
                    <th className="px-4 py-2 font-normal">Sold</th>
                    <th className="px-4 py-2 font-normal">Sqft</th>
                    <th className="px-4 py-2 font-normal">Bd/Ba</th>
                    <th className="px-4 py-2 font-normal">Dist.</th>
                    <th className="px-4 py-2 font-normal">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {comps.map((c) => {
                    const ppsf = c.sqft && c.sqft > 0 ? Math.round(c.sale_price / c.sqft) : null;
                    return (
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-4 py-2">{c.address}{c.city ? `, ${c.city}` : ""}</td>
                        <td className="px-4 py-2">{fmtMoney(c.sale_price)}</td>
                        <td className="px-4 py-2">{ppsf ? `$${ppsf}` : "—"}</td>
                        <td className="px-4 py-2 font-mono text-[var(--w55)]">{c.sale_date}</td>
                        <td className="px-4 py-2">{c.sqft?.toLocaleString() ?? "—"}</td>
                        <td className="px-4 py-2">{c.beds ?? "—"} / {c.baths ?? "—"}</td>
                        <td className="px-4 py-2">{c.distance_miles != null ? `${c.distance_miles} mi` : "—"}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-cyan/15 text-cyan border border-cyan/30">
                            {c.similarity_score ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {mut.isError && (
            <p className="p-3 text-xs text-red-400">{(mut.error as Error).message}</p>
          )}
        </>
      )}
    </section>
  );
}

function MarketIntelSection({ propertyId }: { propertyId: string }) {
  const fetchFn = useServerFn(getMarketIntel);
  const [result, setResult] = useState<MarketIntelResult | null>(null);

  const mut = useMutation({
    mutationFn: (refresh: boolean) => fetchFn({ data: { propertyId, refresh } }),
    onSuccess: (d) => setResult(d),
  });

  const hasData = !!result;
  const cachedLabel = result?.cached
    ? `Cached · refreshes ${new Date(result.expiresAt).toLocaleString()}`
    : result
      ? `Fresh · valid until ${new Date(result.expiresAt).toLocaleString()}`
      : null;

  return (
    <section className="border border-border rounded-lg">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan" />
          <h2 className="font-medium">Neighborhood & Market Intel</h2>
          {cachedLabel && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--w55)]">· {cachedLabel}</span>
          )}
        </div>
        <button
          onClick={() => mut.mutate(hasData)}
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-cyan ${mut.isPending ? "animate-spin" : ""}`} />
          {mut.isPending ? "Researching…" : hasData ? "Refresh intel" : "Get Market Intel"}
        </button>
      </header>

      <div className="p-4 space-y-4">
        {!hasData && !mut.isPending && !mut.isError && (
          <p className="text-sm text-[var(--w55)]">
            Pull current market trends, recent sales, school ratings, and zoning/development changes for this area. Only the public location (city, state, ZIP) is sent to the research provider.
          </p>
        )}

        {mut.isPending && (
          <div className="space-y-2">
            <div className="h-3 w-1/3 rounded bg-white/10 animate-pulse" />
            <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-white/5 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-white/5 animate-pulse" />
          </div>
        )}

        {mut.isError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {(mut.error as Error).message || "Couldn't reach the market intel provider."}
          </div>
        )}

        {hasData && result && (
          <>
            <p className="text-[11px] uppercase tracking-wider text-[var(--w55)]">
              {result.locationLabel}
            </p>
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--w85)]">
              {result.content}
            </div>
            {result.citations.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-[var(--w55)] mb-2">Sources</p>
                <ol className="space-y-1 text-xs">
                  {result.citations.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[var(--w55)]">[{i + 1}]</span>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan hover:underline inline-flex items-center gap-1 break-all"
                      >
                        {c.title || c.url}
                        <ExtLink2 className="h-3 w-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </section>
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

function SaveToWatchlistButton(props: {
  propertyKey: string;
  address: string;
  city: string | null;
  state: string | null;
  county: string | null;
}) {
  const saveFn = useServerFn(upsertWatchlistItem);
  const [saved, setSaved] = useState(false);
  const mut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          property_key: props.propertyKey,
          address: props.address,
          city: props.city,
          state: props.state,
          county: props.county,
          alert_foreclosure: true,
          alert_lis_pendens: true,
          alert_deed_transfer: false,
        },
      }),
    onSuccess: () => setSaved(true),
  });
  return (
    <button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
      title="Save this property to your watchlist"
    >
      {saved ? (
        <>
          <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400" /> Saved to watchlist
        </>
      ) : (
        <>
          <Bookmark className="h-3.5 w-3.5 text-cyan" />
          {mut.isPending ? "Saving…" : "Save to watchlist"}
        </>
      )}
    </button>
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

function ListForAuctionButton({ propertyId, defaultTitle }: { propertyId: string; defaultTitle: string }) {
  const navigate = useNavigate();
  const createFn = useServerFn(createAuction);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [openingBid, setOpeningBid] = useState("");
  // default ends_at = +7 days, ISO local for datetime-local input
  const defaultEnds = useMemo(() => {
    const d = new Date(Date.now() + 7 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const [endsAt, setEndsAt] = useState(defaultEnds);
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => createFn({
      data: {
        propertyId,
        title,
        description: description || null,
        openingBid: Number(openingBid),
        endsAt: new Date(endsAt).toISOString(),
      },
    }),
    onSuccess: (r) => {
      setOpen(false);
      navigate({ to: "/app/auctions/$auctionId", params: { auctionId: r.id } });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5">
          <Gavel className="h-3.5 w-3.5 text-amber-400" /> List for auction
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>List property for auction</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            if (!title.trim() || !openingBid || !endsAt) { setErr("Title, opening bid, and end time are required."); return; }
            if (Number(openingBid) <= 0) { setErr("Opening bid must be positive."); return; }
            if (new Date(endsAt).getTime() <= Date.now()) { setErr("End time must be in the future."); return; }
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[rgba(255,255,255,.04)] border border-border rounded text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full mt-1 px-3 py-2 bg-[rgba(255,255,255,.04)] border border-border rounded text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Opening bid ($)</label>
              <input type="number" min={1} value={openingBid} onChange={(e) => setOpeningBid(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-[rgba(255,255,255,.04)] border border-border rounded text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Ends at</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-[rgba(255,255,255,.04)] border border-border rounded text-sm" />
            </div>
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <DialogFooter>
            <button type="button" onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs rounded border border-border">Cancel</button>
            <button type="submit" disabled={mut.isPending}
              className="px-3 py-1.5 text-xs rounded bg-cyan text-black font-medium disabled:opacity-50">
              {mut.isPending ? "Creating…" : "Create auction"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Inline gallery of Vision Studio renders linked to this property. Reuses
// listRenders (filtered by property_id), with delete + unlink controls so
// the user can manage attachments without leaving the detail page.
function VisionGallerySection({ propertyId }: { propertyId: string }) {
  const listFn = useServerFn(listRenders);
  const deleteFn = useServerFn(deleteRender);
  const linkFn = useServerFn(linkRenderToProperty);
  const { data: renders = [], refetch, isLoading } = useQuery({
    queryKey: ["property-renders", propertyId],
    queryFn: () => listFn({ data: { property_id: propertyId } }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => refetch(),
  });
  const unlink = useMutation({
    mutationFn: (id: string) => linkFn({ data: { id, property_id: null } }),
    onSuccess: () => refetch(),
  });

  const statusClass: Record<string, string> = {
    ready: "bg-green-500/15 text-green-300 border-green-500/30",
    rendering: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    queued: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
  };

  return (
    <section className="border border-border rounded-lg">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan" />
          <h2 className="font-medium">Vision Studio renders</h2>
          <span className="text-[10px] uppercase tracking-wider text-[var(--w55)]">
            · {renders.length} linked
          </span>
        </div>
        <Link
          to="/app/vision"
          search={{ property: propertyId }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan" /> New redesign
        </Link>
      </header>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--w55)]">Loading…</p>
      ) : renders.length === 0 ? (
        <p className="p-4 text-sm text-[var(--w55)]">
          No renders linked yet. Start a redesign and it'll attach to this property automatically.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {renders.map((r) => (
            <div key={r.id} className="border border-border rounded-md overflow-hidden bg-black/20">
              <div className="aspect-video flex items-center justify-center bg-black/30">
                {r.status === "ready" && r.signed_url ? (
                  <img src={r.signed_url} alt={r.prompt ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-[var(--w55)]">
                    {r.status === "failed" ? "Render failed" : "Rendering…"}
                  </span>
                )}
              </div>
              <div className="p-2.5 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border ${statusClass[r.status] ?? ""}`}>
                    {r.status}
                  </span>
                  {r.style && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-border text-[var(--w55)]">
                      {r.style}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--w55)] line-clamp-2">{r.prompt}</p>
                {r.status === "failed" && r.error && (
                  <p className="text-xs text-red-400 line-clamp-2">{r.error}</p>
                )}
                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    onClick={() => unlink.mutate(r.id)}
                    disabled={unlink.isPending}
                    title="Unlink from this property"
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-white/5 text-[var(--w55)]"
                  >
                    <Link2 className="h-3 w-3" /> Unlink
                  </button>
                  <button
                    onClick={() => remove.mutate(r.id)}
                    disabled={remove.isPending}
                    title="Delete render"
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-white/5 text-red-400"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DistressSignals({
  isVacant, isAbsentee, isPreforeclosure, auctionDate, lienAmount, taxOwed, daysOnMarket,
}: {
  isVacant: boolean; isAbsentee: boolean; isPreforeclosure: boolean;
  auctionDate: string | null; lienAmount: number | null; taxOwed: number | null;
  daysOnMarket: number | null;
}) {
  const signals: { label: string; tone: "red" | "amber" | "slate"; detail?: string }[] = [];
  if (isPreforeclosure) signals.push({ label: "Pre-foreclosure / NOD", tone: "red" });
  if (auctionDate) signals.push({ label: "Auction scheduled", tone: "red", detail: auctionDate });
  if (isVacant) signals.push({ label: "Vacant", tone: "amber" });
  if (isAbsentee) signals.push({ label: "Absentee owner", tone: "amber" });
  if (taxOwed && taxOwed > 0) signals.push({ label: "Tax delinquent", tone: "amber", detail: `$${taxOwed.toLocaleString()}` });
  if (lienAmount && lienAmount > 0) signals.push({ label: "Lien", tone: "amber", detail: `$${lienAmount.toLocaleString()}` });
  if (daysOnMarket && daysOnMarket > 120) signals.push({ label: "Stale listing", tone: "slate", detail: `${daysOnMarket} days` });

  return (
    <section className="border border-border rounded-lg">
      <header className="flex items-center gap-2 p-4 border-b border-border">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <h2 className="font-medium">Distress signals</h2>
        <span className="text-[10px] uppercase tracking-wider text-[var(--w55)]">{signals.length} active</span>
      </header>
      <div className="p-4">
        {signals.length === 0 ? (
          <p className="text-sm text-[var(--w55)]">No distress signals flagged on this record.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {signals.map((s) => {
              const cls =
                s.tone === "red"   ? "bg-red-500/15 text-red-300 border-red-500/30" :
                s.tone === "amber" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                                     "bg-white/5 text-[var(--w55)] border-border";
              return (
                <li key={s.label} className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs border ${cls}`}>
                  <span className="font-medium">{s.label}</span>
                  {s.detail && <span className="opacity-80">· {s.detail}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function parseScoreNotes(notes: string | null): { rationale: string | null; signals: string[]; tier: string | null } {
  if (!notes) return { rationale: null, signals: [], tier: null };
  const m = notes.match(/Lead Score\s+\d+\s+\(([^)]+)\):\s*([^\n]+)(?:\nSignals:\s*(.+))?/);
  if (!m) return { rationale: null, signals: [], tier: null };
  return {
    tier: m[1] ?? null,
    rationale: m[2]?.trim() ?? null,
    signals: (m[3] ?? "").split(";").map((s) => s.trim()).filter(Boolean),
  };
}

function AiLeadScoreSection({
  propertyId, leadScore, notes,
}: { propertyId: string; leadScore: number | null; notes: string | null }) {
  const scoreFn = useServerFn(scoreProperty);
  const router = useRouter();
  const mut = useMutation({
    mutationFn: () => scoreFn({ data: { property_id: propertyId } }),
    onSuccess: () => router.invalidate(),
  });
  const live = mut.data ?? null;
  const parsed = parseScoreNotes(notes);
  const score = live?.score ?? leadScore ?? null;
  const tier = live?.tier ?? parsed.tier;
  const rationale = live?.rationale ?? parsed.rationale;
  const signals = live?.signals ?? parsed.signals;

  const tierClass =
    tier === "on_fire" ? "bg-red-500/15 text-red-300 border-red-500/30" :
    tier === "hot"     ? "bg-orange-500/15 text-orange-300 border-orange-500/30" :
    tier === "warm"    ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
    tier === "cold"    ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" :
                         "bg-white/5 text-[var(--w55)] border-border";

  return (
    <section className="border border-border rounded-lg">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <h2 className="font-medium">AI lead scoring</h2>
          {tier && (
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border ${tierClass}`}>
              {tier.replace("_", " ")}
            </span>
          )}
        </div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-cyan ${mut.isPending ? "animate-spin" : ""}`} />
          {mut.isPending ? "Scoring…" : score == null ? "Run AI score" : "Re-score"}
        </button>
      </header>
      <div className="p-4 space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold tabular-nums">{score ?? "—"}</span>
          <span className="text-sm text-[var(--w55)]">/ 100 motivation</span>
        </div>
        {rationale && <p className="text-sm">{rationale}</p>}
        {signals.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--w55)] mb-1">Key signals</p>
            <ul className="flex flex-wrap gap-2">
              {signals.map((s, i) => (
                <li key={i} className="inline-flex items-center rounded px-2 py-1 text-xs bg-white/5 border border-border">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {score == null && !mut.isPending && (
          <p className="text-sm text-[var(--w55)]">
            <Home className="inline h-3.5 w-3.5 mr-1 text-cyan" />
            Run the AI scorer to evaluate seller motivation from equity, distress, vacancy,
            absentee ownership, tax/lien data, and time on market.
          </p>
        )}
        {mut.isError && <p className="text-xs text-red-400">{(mut.error as Error).message}</p>}
      </div>
    </section>
  );
}
