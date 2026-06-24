import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  searchDistressedProperties,
  importDistressedProperties,
} from "@/lib/distress/search.functions";
import { logLookup } from "@/lib/distress/lookup-history.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Search, Download, MapPin, Loader2, History as HistoryIcon } from "lucide-react";

const searchSchema = z.object({
  line1: fallback(z.string(), "").default(""),
  city: fallback(z.string(), "").default(""),
  state: fallback(z.string(), "").default(""),
  zip: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/app/properties/lookup")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Address Lookup — PropAI" },
      {
        name: "description",
        content:
          "Look up a single property by address to view owner, equity, distress signals, value, and import it into your pipeline.",
      },
    ],
  }),
  component: AddressLookup,
});

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

function AddressLookup() {
  const initial = Route.useSearch();
  const [line1, setLine1] = useState(initial.line1);
  const [city, setCity] = useState(initial.city);
  const [state, setState] = useState(initial.state);
  const [zip, setZip] = useState(initial.zip);

  const search = useServerFn(searchDistressedProperties);
  const importFn = useServerFn(importDistressedProperties);
  const logFn = useServerFn(logLookup);

  const searchMut = useMutation({
    mutationFn: async () => {
      if (!line1.trim()) throw new Error("Enter a street address");
      const res = await search({
        data: {
          state: state.trim() ? state.trim().toUpperCase() : undefined,
          city: city.trim() || undefined,
          zip: zip.trim() || undefined,
          limit: 100,
        },
      });
      // Fire-and-forget history log
      logFn({
        data: {
          line1: line1.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
          matchCount: res.records.length,
          provider: res.provider,
          usedFallback: res.usedFallback,
        },
      }).catch(() => {});
      return res;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-run when arriving with prefilled query params (e.g. from history)
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (initial.line1.trim()) {
      autoRanRef.current = true;
      searchMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useNavigate();
  const importMut = useMutation({
    mutationFn: async (rec: NonNullable<typeof searchMut.data>["records"][number]) =>
      importFn({ data: { records: [rec] } }),
    onSuccess: (res) => {
      const id = res.ids?.[0];
      if (id) {
        toast.success("Imported — opening property");
        navigate({ to: "/app/properties/$propertyId", params: { propertyId: id } });
      } else {
        toast.success("Imported to your Properties");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matches = useMemo(() => {
    const all = searchMut.data?.records ?? [];
    const q = line1.trim().toLowerCase();
    if (!q) return all.slice(0, 25);
    return all
      .map((r) => {
        const hay = `${r.address} ${r.city ?? ""} ${r.zip ?? ""}`.toLowerCase();
        let score = 0;
        for (const tok of q.split(/\s+/).filter(Boolean)) {
          if (hay.includes(tok)) score += 1;
        }
        return { r, score };
      })
      .sort((a, b) => b.score - a.score || b.r.leadScore - a.r.leadScore)
      .slice(0, 25)
      .map((m) => m.r);
  }, [searchMut.data, line1]);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Address Lookup</h1>
          <p className="text-sm text-muted-foreground">
            Find a single property by address. Best results when you include city &amp; state or ZIP.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/properties/lookup-history">
            <History className="mr-2 h-4 w-4" />
            History
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property address</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault();
              searchMut.mutate();
            }}
          >
            <div className="md:col-span-6">
              <Label htmlFor="line1">Street address</Label>
              <Input
                id="line1"
                placeholder="123 Main St"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Brooklyn"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="NY"
                value={state}
                onChange={(e) => setState(e.target.value.slice(0, 2))}
                maxLength={2}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input
                id="zip"
                placeholder="11201"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <Button type="submit" disabled={searchMut.isPending}>
                {searchMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Look up
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {searchMut.data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {matches.length} match{matches.length === 1 ? "" : "es"}
            </h2>
            <Badge variant="outline">
              Source: {searchMut.data.usedFallback ? "sample data" : searchMut.data.provider}
            </Badge>
          </div>

          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No properties found for that area. Try a broader city/ZIP, or a featured market (NY,
              NJ, CT, PA).
            </p>
          ) : (
            <div className="grid gap-3">
              {matches.map((r) => (
                <Card key={r.sourceRecordId}>
                  <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_auto] items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{r.address}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[r.city, r.state, r.zip].filter(Boolean).join(", ")}
                        {r.county ? ` · ${r.county} County` : ""}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <Badge variant="secondary" className="capitalize">
                          {r.distressType.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline">Score {r.leadScore}</Badge>
                        {r.isVacant && <Badge variant="outline">Vacant</Badge>}
                        {r.isAbsentee && <Badge variant="outline">Absentee</Badge>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 text-xs text-muted-foreground">
                        <div>
                          <div className="text-foreground">{fmtMoney(r.estimatedValue)}</div>
                          <div>Estimated value</div>
                        </div>
                        <div>
                          <div className="text-foreground">{fmtMoney(r.equity)}</div>
                          <div>Equity</div>
                        </div>
                        <div>
                          <div className="text-foreground">{fmtMoney(r.listPrice)}</div>
                          <div>List price</div>
                        </div>
                        <div>
                          <div className="text-foreground">
                            {r.beds ?? "—"}bd · {r.baths ?? "—"}ba · {r.sqft?.toLocaleString() ?? "—"} sqft
                          </div>
                          <div>Built {r.yearBuilt ?? "—"}</div>
                        </div>
                      </div>
                      {r.ownerName && (
                        <div className="text-xs pt-1">
                          <span className="text-muted-foreground">Owner: </span>
                          {r.ownerName}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={importMut.isPending}
                      onClick={() => importMut.mutate(r)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Import
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
