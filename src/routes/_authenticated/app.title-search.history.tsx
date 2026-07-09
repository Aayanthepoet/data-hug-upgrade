import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2 } from "lucide-react";
import { listTitleSearches, type TitleSearchResult } from "@/lib/foreclosure/foreclosure.functions";
import { TitleSearchPanel, printTitleSearch } from "@/components/title-search/TitleSearchPanel";

export const Route = createFileRoute("/_authenticated/app/title-search/history")({
  head: () => ({
    meta: [
      { title: "Title Search History — PropAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const list = useServerFn(listTitleSearches);
  const q = useQuery({ queryKey: ["title-search-history"], queryFn: () => list() });
  const [selected, setSelected] = useState<{ address: string; result: TitleSearchResult } | null>(null);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/app/title-search">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Title Search History</h1>
      </div>

      {q.isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      )}

      {!q.isLoading && (q.data?.items ?? []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No title searches yet. Run your first one from the{" "}
            <Link to="/app/title-search" className="text-primary underline">
              Title Search page
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(q.data?.items ?? []).map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer hover:border-primary transition"
            onClick={() => setSelected({ address: item.address, result: item.results })}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{item.address}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>{new Date(item.created_at).toLocaleString()}</div>
              <div>
                Owner: {item.results?.ownerOfRecord || "—"} · Marketable: {item.results?.marketableTitle || "—"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.address}</DialogTitle>
          </DialogHeader>
          {selected && (
            <TitleSearchPanel
              result={selected.result}
              onPrint={() => printTitleSearch(selected.result)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
