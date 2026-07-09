import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, History } from "lucide-react";
import { toast } from "sonner";
import {
  runTitleSearch,
  getTitleSearchQuota,
  type TitleSearchResult,
} from "@/lib/foreclosure/foreclosure.functions";
import { TitleSearchPanel, printTitleSearch } from "@/components/title-search/TitleSearchPanel";

export const Route = createFileRoute("/_authenticated/app/title-search")({
  head: () => ({
    meta: [
      { title: "Title Search — PropAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TitleSearchPage,
});

function TitleSearchPage() {
  const run = useServerFn(runTitleSearch);
  const getQuota = useServerFn(getTitleSearchQuota);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TitleSearchResult | null>(null);

  const quotaQ = useQuery({ queryKey: ["title-search-quota"], queryFn: () => getQuota() });

  async function onRun() {
    if (!address.trim()) {
      toast.error("Enter an address");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await run({ data: { address: address.trim() } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      quotaQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Title search failed");
    } finally {
      setLoading(false);
    }
  }

  const q = quotaQ.data;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Preliminary Title Search</h1>
          <p className="text-sm text-muted-foreground">
            Search NY public records — ACRIS, NYSCEF, NYC Finance, HPD, county clerks — for any property address.
          </p>
        </div>
        <Link to="/app/title-search/history">
          <Button variant="outline" size="sm">
            <History className="w-4 h-4 mr-1.5" />
            History
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Run a Title Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Brooklyn, NY 11201"
              className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
              onKeyDown={(e) => e.key === "Enter" && !loading && onRun()}
            />
            <Button onClick={onRun} disabled={loading} className="md:w-44">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {loading ? "Searching..." : "Run Title Search"}
            </Button>
          </div>
          {q && (
            <p className="text-xs text-muted-foreground">
              {q.limit === null
                ? "Unlimited title searches on your current plan."
                : `${q.used}/${q.limit} title searches used this month. Upgrade to Pro or Agency for unlimited.`}
            </p>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Searching public records...
        </div>
      )}

      {result && (
        <Card>
          <CardContent className="pt-6">
            <TitleSearchPanel result={result} onPrint={() => printTitleSearch(result)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
