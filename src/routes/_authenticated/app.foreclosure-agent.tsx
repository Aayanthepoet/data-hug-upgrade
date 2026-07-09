import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  analyzeInvestment,
  generateOutreachLetter,
  runTitleSearch,
  searchForeclosureProperties,
  skipTraceOwner,
  type ForeclosureProperty,
  type TitleSearchResult,
} from "@/lib/foreclosure/foreclosure.functions";
import { TitleSearchPanel, printTitleSearch } from "@/components/title-search/TitleSearchPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Search, CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/foreclosure-agent")({
  head: () => ({
    meta: [
      { title: "Foreclosure Research Agent — PropAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForeclosureAgentPage,
});

const COUNTIES = [
  "Brooklyn Kings County",
  "Bronx",
  "Manhattan",
  "Queens",
  "Staten Island",
  "Nassau County Long Island",
  "Suffolk County Long Island",
  "Rockland County",
  "Westchester County",
  "Poughkeepsie Dutchess County",
  "Orange County",
  "Ulster County",
  "Albany County",
  "Erie County Buffalo",
  "Monroe County Rochester",
];

const TABS = ["All", "Pre-Foreclosure", "Auction", "Bank REO", "Short Sale"] as const;
type TabType = (typeof TABS)[number];

const TYPE_VARIANT: Record<string, string> = {
  "Pre-Foreclosure": "bg-amber-500/10 text-amber-600 border-amber-500/30",
  Auction: "bg-red-500/10 text-red-600 border-red-500/30",
  "Bank REO": "bg-blue-500/10 text-blue-600 border-blue-500/30",
  "Short Sale": "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

function ForeclosureAgentPage() {
  const search = useServerFn(searchForeclosureProperties);
  const genLetter = useServerFn(generateOutreachLetter);
  const analyze = useServerFn(analyzeInvestment);
  const skip = useServerFn(skipTraceOwner);

  const [county, setCounty] = useState<string>(COUNTIES[0]);
  const [tab, setTab] = useState<TabType>("All");
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<ForeclosureProperty[]>([]);
  const [selected, setSelected] = useState<ForeclosureProperty | null>(null);

  const [testAddress, setTestAddress] = useState("");
  const [testCity, setTestCity] = useState("Brooklyn, NY");
  const [testType, setTestType] = useState<string>("Pre-Foreclosure");

  const [letter, setLetter] = useState<string>("");
  const [analysis, setAnalysis] = useState<string>("");
  const [skipPortals, setSkipPortals] = useState<
    Array<{
      portal_name: string;
      url: string;
      is_free: boolean;
      what_it_yields: string;
      steps: string[];
      description: string;
    }>
  >([]);
  const [skipRaw, setSkipRaw] = useState<string>("");
  const [skipFormatFailed, setSkipFormatFailed] = useState(false);
  const [titleResult, setTitleResult] = useState<TitleSearchResult | null>(null);
  const [actionLoading, setActionLoading] = useState<"letter" | "analysis" | "skip" | "title" | null>(null);
  const runTitle = useServerFn(runTitleSearch);

  function runTestWorkflow() {
    if (!testAddress.trim()) {
      toast.error("Enter an address to test");
      return;
    }
    const mock: ForeclosureProperty = {
      address: testAddress.trim(),
      city: testCity.trim() || "Brooklyn, NY",
      neighborhood: "Unknown",
      type: testType,
      price: "N/A",
      beds: "N/A",
      baths: "N/A",
      sqft: "N/A",
      auctionDate: "N/A",
      indexNo: "N/A",
      lender: "Unknown",
      owner: "Unknown",
      ownerPhone: "",
      ownerEmail: "",
      ownerAddress: "",
      contactSource: "",
      notes: "Test entry — manual address input; details unknown, please research.",
    };
    openDetail(mock);
  }

  async function runSearch() {
    setLoading(true);
    setProperties([]);
    try {
      const res = await search({ data: { county, type: tab } });
      setProperties(res.properties);
      if (res.properties.length === 0) toast.info("No properties returned. Try another county.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function openDetail(p: ForeclosureProperty) {
    setSelected(p);
    setLetter("");
    setAnalysis("");
    setSkipPortals([]);
    setSkipRaw("");
    setSkipFormatFailed(false);
    setTitleResult(null);
  }

  async function onTitleSearch() {
    if (!selected) return;
    const addr = [selected.address, selected.city].filter(Boolean).join(", ");
    if (!addr) {
      toast.error("Property is missing an address");
      return;
    }
    setActionLoading("title");
    try {
      const res = await runTitle({ data: { address: addr } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTitleResult(res.result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Title search failed");
    } finally {
      setActionLoading(null);
    }
  }

  const hasContact = (p: ForeclosureProperty) => Boolean(p.ownerPhone || p.ownerEmail);

  async function onGenerateLetter() {
    if (!selected) return;
    setActionLoading("letter");
    try {
      const { letter } = await genLetter({ data: { property: selected } });
      setLetter(letter);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate letter");
    } finally {
      setActionLoading(null);
    }
  }

  async function onAnalyze() {
    if (!selected) return;
    setActionLoading("analysis");
    try {
      const { analysis } = await analyze({ data: { property: selected } });
      setAnalysis(analysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function onSkipTrace() {
    if (!selected) return;
    setActionLoading("skip");
    try {
      const res = await skip({ data: { property: selected } });
      setSkipPortals(res.portals);
      setSkipRaw(res.raw ?? "");
      setSkipFormatFailed(Boolean(res.formattingFailed));
      if (!res.formattingFailed && res.portals.length === 0) {
        toast.info("No portals returned.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Skip trace failed");
    } finally {
      setActionLoading(null);
    }
  }


  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Foreclosure Research Agent</h1>
        <p className="text-sm text-muted-foreground">
          NY distress research across NYC Courts, PropertyShark, Zillow, RealtyTrac, and
          Foreclosure.com.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">County</label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runSearch} disabled={loading} className="md:w-44">
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              {loading ? "Researching..." : "Search"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-sm px-3 py-1.5 rounded-md border transition ${
                  tab === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Test Workflow</CardTitle>
          <p className="text-xs text-muted-foreground">
            Enter an address to open the detail panel and run outreach, skip trace, and
            investment analysis against it.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Address</label>
              <input
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                placeholder="123 Main St"
                className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">City, State</label>
              <input
                value={testCity}
                onChange={(e) => setTestCity(e.target.value)}
                placeholder="Brooklyn, NY"
                className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Pre-Foreclosure", "Auction", "Bank REO", "Short Sale"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runTestWorkflow} className="md:w-44">
              Run Workflow
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Researching {county}...
        </div>
      )}

      {!loading && properties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p, i) => (
            <Card
              key={`${p.address}-${i}`}
              className="cursor-pointer hover:border-primary transition"
              onClick={() => openDetail(p)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{p.address}</CardTitle>
                  {hasContact(p) && (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30 shrink-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Contact
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.neighborhood ? `${p.neighborhood}, ` : ""}
                  {p.city}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      TYPE_VARIANT[p.type] ?? "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {p.type}
                  </span>
                  {p.price && <span className="text-xs font-medium">{p.price}</span>}
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1">
                  {p.beds && <span>{p.beds} bd</span>}
                  {p.baths && <span>{p.baths} ba</span>}
                  {p.sqft && <span>{p.sqft} sf</span>}
                </div>
                {p.auctionDate && (
                  <div className="text-xs text-muted-foreground">Auction: {p.auctionDate}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.address}</DialogTitle>
                <DialogDescription>
                  {selected.neighborhood ? `${selected.neighborhood}, ` : ""}
                  {selected.city}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      TYPE_VARIANT[selected.type] ??
                      "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {selected.type}
                  </span>
                  {selected.price && (
                    <span className="text-xs px-2 py-1 rounded bg-muted">{selected.price}</span>
                  )}
                  {hasContact(selected) && (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Contact Found
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {selected.beds && <Field label="Beds" value={selected.beds} />}
                  {selected.baths && <Field label="Baths" value={selected.baths} />}
                  {selected.sqft && <Field label="Sqft" value={selected.sqft} />}
                  {selected.auctionDate && (
                    <Field label="Auction Date" value={selected.auctionDate} />
                  )}
                  {selected.indexNo && <Field label="Index #" value={selected.indexNo} />}
                  {selected.lender && <Field label="Lender" value={selected.lender} />}
                </div>

                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="font-medium">Owner</div>
                  {selected.owner && <div>{selected.owner}</div>}
                  {selected.ownerAddress && (
                    <div className="text-muted-foreground text-xs">{selected.ownerAddress}</div>
                  )}
                  <div className="flex flex-col gap-1">
                    {selected.ownerPhone && (
                      <a
                        href={`tel:${selected.ownerPhone.replace(/[^0-9+]/g, "")}`}
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {selected.ownerPhone}
                      </a>
                    )}
                    {selected.ownerEmail && (
                      <a
                        href={`mailto:${selected.ownerEmail}`}
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {selected.ownerEmail}
                      </a>
                    )}
                    {selected.contactSource && (
                      <div className="text-xs text-muted-foreground">
                        Source: {selected.contactSource}
                      </div>
                    )}
                  </div>
                </div>

                {selected.notes && (
                  <div className="text-sm text-muted-foreground border-t pt-3">
                    {selected.notes}
                  </div>
                )}

                <div className="border-t pt-3 -mx-1 px-1 flex flex-wrap gap-2 overflow-x-auto">
                  <Button
                    size="sm"
                    onClick={onGenerateLetter}
                    disabled={actionLoading !== null}
                    className="whitespace-nowrap shrink-0"
                  >
                    {actionLoading === "letter" && (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    )}
                    Generate Outreach Letter
                  </Button>
                  {!hasContact(selected) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onSkipTrace}
                      disabled={actionLoading !== null}
                      className="whitespace-nowrap shrink-0"
                    >
                      {actionLoading === "skip" && (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      )}
                      Skip Trace Owner
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAnalyze}
                    disabled={actionLoading !== null}
                    className="whitespace-nowrap shrink-0"
                  >
                    {actionLoading === "analysis" && (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    )}
                    Analyze Investment Value
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onTitleSearch}
                    disabled={actionLoading !== null}
                    className="whitespace-nowrap shrink-0"
                  >
                    {actionLoading === "title" && (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    )}
                    Title Search
                  </Button>
                </div>

                {letter && (
                  <div className="border rounded p-3 bg-muted/40">
                    <div className="text-xs font-medium mb-1">Outreach Letter</div>
                    <pre className="whitespace-pre-wrap text-sm font-sans">{letter}</pre>
                  </div>
                )}
                {analysis && (
                  <div className="border rounded p-3 bg-muted/40">
                    <div className="text-xs font-medium mb-1">Investment Analysis</div>
                    <pre className="whitespace-pre-wrap text-sm font-sans">{analysis}</pre>
                  </div>
                )}
                {(skipPortals.length > 0 || skipFormatFailed) && (
                  <div className="space-y-3 min-w-0">
                    <div className="text-xs font-medium">Skip Trace Leads</div>

                    {skipFormatFailed && (
                      <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200 p-3 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Formatting failed — showing raw results</span>
                      </div>
                    )}

                    {skipFormatFailed && skipRaw && (
                      <div className="rounded border border-border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {skipRaw}
                      </div>
                    )}

                    {skipPortals.map((portal, i) => (
                      <PortalCard key={`${portal.url}-${i}`} portal={portal} />
                    ))}
                  </div>
                )}
                {titleResult && (
                  <div className="border rounded p-3 bg-muted/40">
                    <TitleSearchPanel
                      result={titleResult}
                      onPrint={() => printTitleSearch(titleResult)}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function PortalCard({
  portal,
}: {
  portal: {
    portal_name: string;
    url: string;
    is_free: boolean;
    what_it_yields: string;
    steps: string[];
    description: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLongDescription = portal.description.trim().length > 0;

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3 min-w-0 break-words">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <span className="font-semibold text-sm text-foreground break-words">
            {portal.portal_name}
          </span>
          {portal.is_free && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shrink-0">
              Free · Public
            </Badge>
          )}
        </div>
        <a
          href={portal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0"
        >
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            Open Portal
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </a>
      </div>

      {portal.what_it_yields && (
        <p className="text-xs text-muted-foreground">{portal.what_it_yields}</p>
      )}

      {portal.steps.length > 0 && (
        <ol className="list-decimal pl-5 space-y-1 text-sm marker:text-muted-foreground">
          {portal.steps.map((step, i) => (
            <li key={i} className="break-words">{step}</li>
          ))}
        </ol>
      )}

      {hasLongDescription && (
        <div className="text-xs text-muted-foreground">
          <p className={expanded ? "" : "line-clamp-3"}>{portal.description}</p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-primary hover:underline text-xs"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}
