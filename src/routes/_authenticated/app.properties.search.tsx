import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  searchDistressedProperties,
  importDistressedProperties,
  saveSearch,
  type DistressFilters,
} from "@/lib/distress/search.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Save, Download, RefreshCw } from "lucide-react";
import { getCountiesForState } from "@/lib/distress/counties";

export const Route = createFileRoute("/_authenticated/app/properties/search")({
  head: () => ({ meta: [{ title: "Find Distressed Properties — PropAI" }] }),
  component: PropertySearch,
});

type DistressType = NonNullable<DistressFilters["distressTypes"]>[number];

const TYPE_OPTIONS: { value: DistressType; label: string }[] = [
  { value: "reo", label: "REO / Bank-owned" },
  { value: "preforeclosure", label: "Pre-foreclosure / NOD" },
  { value: "auction", label: "Auction scheduled" },
  { value: "tax_lien", label: "Tax lien" },
  { value: "tax_delinquent", label: "Tax delinquent" },
  { value: "fsbo_stale", label: "FSBO 60+ days" },
  { value: "vacant", label: "Vacant" },
  { value: "absentee", label: "Absentee owner" },
];

const FEATURED_STATES = ["NY", "NJ", "CT", "PA"];
const OTHER_STATES = [
  "AL","AK","AZ","AR","CA","CO","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NM","NC",
  "ND","OH","OK","OR","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function PropertySearch() {
  const qc = useQueryClient();
  const search = useServerFn(searchDistressedProperties);
  const importFn = useServerFn(importDistressedProperties);
  const saveFn = useServerFn(saveSearch);

  const [state, setState] = useState("NY");
  const [county, setCounty] = useState<string>("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [types, setTypes] = useState<DistressType[]>(["preforeclosure","reo","tax_lien","fsbo_stale"]);
  const [minEquity, setMinEquity] = useState("");
  const [minDom, setMinDom] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchName, setSearchName] = useState("");

  const counties = getCountiesForState(state);
  const activeCounty = counties.find((c) => c.name === county);
  const zipSuggestions = activeCounty?.zips ?? [];

  const filters = (): DistressFilters => ({
    state: state || undefined,
    county: county || undefined,
    zip: zip.trim() || undefined,
    city: city.trim() || undefined,
    distressTypes: types.length ? types : undefined,
    minEquity: minEquity ? Number(minEquity) : undefined,
    minDaysOnMarket: minDom ? Number(minDom) : undefined,
    minListPrice: minPrice ? Number(minPrice) : undefined,
    maxListPrice: maxPrice ? Number(maxPrice) : undefined,
    limit: 50,
  });

  const runMutation = useMutation({
    mutationFn: () => search({ data: filters() }),
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const records = runMutation.data?.filter((r) => selected.has(r.sourceRecordId)) ?? [];
      if (!records.length) throw new Error("Select at least one property");
      return importFn({ data: { records } });
    },
    onSuccess: (r) => {
      toast.success(`Imported ${r.imported} properties to your workspace`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!searchName.trim()) throw new Error("Name your search first");
      return saveFn({ data: { name: searchName.trim(), filters: filters() } });
    },
    onSuccess: () => {
      toast.success("Search saved");
      setSearchName("");
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savedQuery = useQuery({
    queryKey: ["saved-searches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("id, name, filters, last_run_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleType = (t: DistressType) => {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const results = runMutation.data ?? [];
  const allSelected = results.length > 0 && results.every((r) => selected.has(r.sourceRecordId));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(results.map((r) => r.sourceRecordId)));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--w55)]">Properties</p>
        <h1 className="text-3xl font-bold mt-1">
          Find <span className="h-italic">distressed</span> properties
        </h1>
        <p className="text-sm text-[var(--w55)] mt-2">
          Search REO, pre-foreclosure, tax-lien, and stale FSBO listings. Save searches, import to your workspace, and add to lead lists.
        </p>
        <p className="text-xs text-[var(--w55)] mt-2">
          Currently using <Badge variant="outline">mock data</Badge> — swap in a paid provider (ATTOM / BatchData) without changing this UI.
        </p>
      </div>

      {/* Filters */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>State</Label>
            <Select
              value={state}
              onValueChange={(v) => { setState(v); setCounty(""); setZip(""); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                <div className="px-2 py-1 text-xs uppercase tracking-wider text-[var(--w55)]">Featured markets</div>
                {FEATURED_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s} {s === "PA" ? "— incl. Philadelphia" : s === "NY" ? "— incl. NYC" : ""}
                  </SelectItem>
                ))}
                <div className="px-2 py-1 mt-1 text-xs uppercase tracking-wider text-[var(--w55)] border-t border-border">All states</div>
                {OTHER_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>County</Label>
            {counties.length > 0 ? (
              <Select
                value={county || "__all"}
                onValueChange={(v) => { setCounty(v === "__all" ? "" : v); setZip(""); }}
              >
                <SelectTrigger><SelectValue placeholder="All counties" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="__all">All counties</SelectItem>
                  {counties.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="e.g. Harris" />
            )}
          </div>
          <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="optional" /></div>
          <div>
            <Label>ZIP {zipSuggestions.length > 0 && <span className="text-[var(--w55)] text-xs">(suggestions)</span>}</Label>
            <Input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="optional"
              list="zip-suggestions"
            />
            {zipSuggestions.length > 0 && (
              <datalist id="zip-suggestions">
                {zipSuggestions.map((z) => <option key={z} value={z} />)}
              </datalist>
            )}
          </div>
          <div><Label>Min equity ($)</Label><Input type="number" value={minEquity} onChange={(e) => setMinEquity(e.target.value)} placeholder="50000" /></div>
          <div><Label>Min days on market</Label><Input type="number" value={minDom} onChange={(e) => setMinDom(e.target.value)} placeholder="60" /></div>
          <div><Label>Min price ($)</Label><Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} /></div>
          <div><Label>Max price ($)</Label><Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></div>
        </div>

        <div>
          <Label>Distress types</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {TYPE_OPTIONS.map((o) => (
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
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-2">
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            {runMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Search
          </Button>
          <div className="flex items-end gap-2 ml-auto">
            <div>
              <Label>Save this search</Label>
              <Input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="e.g. Houston preforeclosures" className="w-56" />
            </div>
            <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />Save
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="border border-border rounded-lg overflow-x-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm">
              <span className="font-medium">{results.length}</span>
              <span className="text-[var(--w55)]"> properties found</span>
              {selected.size > 0 && <span className="text-cyan ml-3">{selected.size} selected</span>}
            </div>
            <Button
              size="sm"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || selected.size === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Import selected
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[rgba(255,255,255,.03)] text-left text-xs uppercase tracking-wider text-[var(--w55)]">
              <tr>
                <th className="px-4 py-3"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Distress</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Equity</th>
                <th className="px-4 py-3">List $</th>
                <th className="px-4 py-3">DOM</th>
                <th className="px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.sourceRecordId} className="border-t border-border hover:bg-[rgba(255,255,255,.02)]">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(r.sourceRecordId)}
                      onCheckedChange={(c) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (c) next.add(r.sourceRecordId); else next.delete(r.sourceRecordId);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.address}</div>
                    <div className="text-xs text-[var(--w55)]">{r.city}, {r.state} {r.zip}</div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="secondary">{r.distressType.replace("_"," ")}</Badge></td>
                  <td className="px-4 py-3">${r.estimatedValue?.toLocaleString()}</td>
                  <td className="px-4 py-3">${r.equity?.toLocaleString()}</td>
                  <td className="px-4 py-3">{r.listPrice ? `$${r.listPrice.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3">{r.daysOnMarket ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono ${r.leadScore >= 70 ? "text-emerald-400" : r.leadScore >= 40 ? "text-yellow-400" : "text-[var(--w55)]"}`}>
                      {r.leadScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Saved searches */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Saved searches</h2>
        {savedQuery.isLoading ? (
          <div className="text-sm text-[var(--w55)]">Loading…</div>
        ) : !savedQuery.data?.length ? (
          <div className="text-sm text-[var(--w55)]">No saved searches yet.</div>
        ) : (
          <ul className="space-y-2">
            {savedQuery.data.map((s) => (
              <li key={s.id} className="border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[var(--w55)]">
                    {JSON.stringify(s.filters)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const f = s.filters as DistressFilters;
                    setState(f.state ?? "NY");
                    setCounty(f.county ?? "");
                    setCity(f.city ?? "");
                    setZip(f.zip ?? "");
                    setTypes(f.distressTypes ?? []);
                    setMinEquity(f.minEquity?.toString() ?? "");
                    setMinDom(f.minDaysOnMarket?.toString() ?? "");
                    setMinPrice(f.minListPrice?.toString() ?? "");
                    setMaxPrice(f.maxListPrice?.toString() ?? "");
                    runMutation.mutate();
                  }}
                >
                  <Search className="h-4 w-4 mr-2" />Run
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
