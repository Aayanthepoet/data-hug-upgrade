import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  searchDistressedProperties,
  importDistressedProperties,
  type DistressFilters,
} from "@/lib/distress/search.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw, MapPin, Plus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/properties/search")({
  head: () => ({ meta: [{ title: "Property Search — PropAI" }] }),
  component: PropertySearchPage,
});

// Markets we actually have wired up via free public APIs.
type Market =
  | { id: "nyc"; label: "New York City"; state: "NY" }
  | { id: "philly"; label: "Philadelphia"; state: "PA" };

const MARKETS: Market[] = [
  { id: "nyc", label: "New York City", state: "NY" },
  { id: "philly", label: "Philadelphia", state: "PA" },
];

const NYC_BOROUGHS: { value: string; label: string }[] = [
  { value: "New York (Manhattan)", label: "Manhattan" },
  { value: "Kings (Brooklyn)", label: "Brooklyn" },
  { value: "Queens", label: "Queens" },
  { value: "Bronx", label: "Bronx" },
  { value: "Richmond (Staten Island)", label: "Staten Island" },
];

// Only distress types we can actually answer from NYC Socrata / Philly Carto.
// pre-foreclosure -> NYC HPD dataset
// tax delinquent  -> Philly real_estate_tax_balances (the closest thing to "tax lien")
// absentee owner  -> both providers infer this from owner mailing address
type SupportedType = "preforeclosure" | "tax_delinquent" | "absentee";

const TYPE_OPTIONS: { value: SupportedType; label: string; markets: Market["id"][] }[] = [
  { value: "preforeclosure", label: "Pre-foreclosure", markets: ["nyc"] },
  { value: "tax_delinquent", label: "Tax delinquent", markets: ["philly"] },
  { value: "absentee",       label: "Absentee / out-of-state owner", markets: ["nyc", "philly"] },
];

type ResultRow = Awaited<ReturnType<typeof searchDistressedProperties>>["records"][number];

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function PropertySearchPage() {
  const navigate = useNavigate();
  const search = useServerFn(searchDistressedProperties);
  const importFn = useServerFn(importDistressedProperties);

  const [marketId, setMarketId] = useState<Market["id"]>("nyc");
  const market = MARKETS.find((m) => m.id === marketId)!;
  const [borough, setBorough] = useState<string>("");
  const [zip, setZip] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [types, setTypes] = useState<SupportedType[]>(["preforeclosure", "tax_delinquent", "absentee"]);
  const [absenteeOnly, setAbsenteeOnly] = useState(false);

  const availableTypes = useMemo(
    () => TYPE_OPTIONS.filter((t) => t.markets.includes(marketId)),
    [marketId],
  );

  const buildFilters = (): DistressFilters => {
    // Only send distress types this market supports.
    const activeTypes = types.filter((t) => availableTypes.some((a) => a.value === t));
    return {
      state: market.state,
      county: marketId === "nyc" ? (borough || undefined) : "Philadelphia",
      city: marketId === "philly" ? "Philadelphia" : undefined,
      zip: zip.trim() || undefined,
      distressTypes: activeTypes.length ? activeTypes : undefined,
      minListPrice: minValue ? Number(minValue) : undefined,
      maxListPrice: maxValue ? Number(maxValue) : undefined,
      limit: 50,
    };
  };

  const runMutation = useMutation({
    mutationFn: () => search({ data: buildFilters() }),
    onError: (e: Error) => toast.error(e.message),
  });

  const importOne = useMutation({
    mutationFn: async (r: ResultRow) => importFn({ data: { records: [r] } }),
    onSuccess: (res) => {
      const id = res.ids?.[0];
      toast.success("Saved to your pipeline");
      if (id) navigate({ to: "/app/properties/$propertyId", params: { propertyId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openRow = (r: ResultRow) => {
    if (importOne.isPending) return;
    importOne.mutate(r);
  };

  const toggleType = (t: SupportedType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const results = (runMutation.data?.records ?? []) as ResultRow[];
  const filteredResults = absenteeOnly ? results.filter((r) => r.isAbsentee) : results;
  const usedFallback = runMutation.data?.usedFallback;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--w55)]">Properties</p>
        <h1 className="text-3xl font-bold mt-1">
          Property <span className="h-italic">search</span>
        </h1>
        <p className="text-sm text-[var(--w55)] mt-2">
          Search distressed properties from free public data.
        </p>
        <p className="text-xs text-[var(--w55)] mt-2">
          Coverage: <Badge variant="outline">NYC</Badge> &amp; <Badge variant="outline">Philadelphia</Badge>. More markets coming soon.
        </p>
      </div>

      {/* Filters */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Market</Label>
            <Select
              value={marketId}
              onValueChange={(v) => {
                setMarketId(v as Market["id"]);
                setBorough("");
                setZip("");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {marketId === "nyc" && (
            <div>
              <Label>Borough</Label>
              <Select value={borough || "__all"} onValueChange={(v) => setBorough(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All boroughs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All boroughs</SelectItem>
                  {NYC_BOROUGHS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>ZIP (optional)</Label>
            <Input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder={marketId === "nyc" ? "e.g. 10001" : "e.g. 19121"}
              inputMode="numeric"
            />
          </div>

          <div>
            <Label>Min assessed value ($)</Label>
            <Input
              type="number"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="100000"
            />
          </div>

          <div>
            <Label>Max assessed value ($)</Label>
            <Input
              type="number"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="2000000"
            />
          </div>
        </div>

        <div>
          <Label>Distress type</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {availableTypes.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleType(o.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  types.includes(o.value)
                    ? "bg-cyan text-black border-cyan"
                    : "border-border text-[var(--w55)] hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--w55)] mt-2">
            Only filters supported by the current data sources are shown.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="absentee-only"
            type="checkbox"
            checked={absenteeOnly}
            onChange={(e) => setAbsenteeOnly(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="absentee-only" className="cursor-pointer">
            Owner type: absentee / out-of-state only
          </Label>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            {runMutation.isPending
              ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              : <Search className="h-4 w-4 mr-2" />}
            Search
          </Button>
          {runMutation.data && (
            <span className="text-xs text-[var(--w55)]">
              {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Honest "no live matches" banner */}
      {runMutation.data && usedFallback && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 text-sm">
          The live <strong>{market.label}</strong> data source didn't respond. Try again
          in a moment, or widen your filters.
        </div>
      )}

      {/* Errors */}
      {runMutation.isError && (
        <div role="alert" className="border border-destructive/40 bg-destructive/10 rounded-lg p-3 text-sm">
          {(runMutation.error as Error).message}
        </div>
      )}

      {/* Results */}
      {!runMutation.data && !runMutation.isPending && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <MapPin className="h-8 w-8 mx-auto text-[var(--w55)]" />
          <p className="mt-3 font-medium">Search to see distressed properties</p>
          <p className="text-sm text-[var(--w55)] mt-1">
            Pick a market, choose distress types, and hit Search.
          </p>
        </div>
      )}

      {runMutation.data && filteredResults.length === 0 && !usedFallback && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <p className="font-medium">No properties match those filters</p>
          <p className="text-sm text-[var(--w55)] mt-1">
            Try clearing the ZIP, widening the value range, or selecting more distress types.
          </p>
        </div>
      )}

      {filteredResults.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--w05)] text-left text-xs uppercase tracking-wider text-[var(--w55)]">
              <tr>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Distress</th>
                <th className="px-4 py-3">Assessed value</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Occupancy</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((r) => {
                const label = TYPE_OPTIONS.find((t) => t.value === r.distressType)?.label ?? r.distressType;
                const isOpening = importOne.isPending && importOne.variables?.sourceRecordId === r.sourceRecordId;
                return (
                  <tr
                    key={r.sourceRecordId}
                    role="button"
                    tabIndex={0}
                    onClick={() => openRow(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openRow(r);
                      }
                    }}
                    aria-label={`Open ${r.address}`}
                    className="border-t border-border align-top cursor-pointer hover:bg-[var(--w05)] focus:bg-[var(--w05)] focus:outline-none transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-cyan hover:underline">{r.address}</div>
                      <div className="text-xs text-[var(--w55)]">
                        {[r.city, r.state, r.zip].filter(Boolean).join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{label}</Badge>
                    </td>
                    <td className="px-4 py-3">{fmtMoney(r.estimatedValue)}</td>
                    <td className="px-4 py-3">{r.ownerName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.isAbsentee
                        ? <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Absentee</Badge>
                        : <Badge variant="outline">Owner-occupied</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => importOne.mutate(r)}
                        disabled={importOne.isPending}
                      >
                        {isOpening
                          ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <Plus className="h-3.5 w-3.5 mr-1" />}
                        Save to pipeline
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
