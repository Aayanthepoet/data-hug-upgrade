import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listLookupHistory,
  deleteLookupHistory,
} from "@/lib/distress/lookup-history.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History as HistoryIcon, Search, Trash2, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/properties/lookup-history")({
  head: () => ({
    meta: [
      { title: "Lookup History — PropAI" },
      {
        name: "description",
        content: "Revisit previous address lookups and re-run them with one click.",
      },
    ],
  }),
  component: LookupHistoryPage,
});

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LookupHistoryPage() {
  const listFn = useServerFn(listLookupHistory);
  const deleteFn = useServerFn(deleteLookupHistory);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["lookup-history"],
    queryFn: () => listFn(),
  });

  const deleteMut = useMutation({
    mutationFn: (vars: { id?: string; all?: boolean }) => deleteFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lookup-history"] });
      toast.success("Removed from history");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="h-6 w-6" /> Lookup History
          </h1>
          <p className="text-sm text-muted-foreground">
            Your last 100 address lookups. Click re-run to repeat any search.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/properties/lookup">
              <Search className="mr-2 h-4 w-4" /> New lookup
            </Link>
          </Button>
          {rows.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Clear all lookup history?")) deleteMut.mutate({ all: true });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear all
            </Button>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
            <p>No lookups yet.</p>
            <Button asChild size="sm">
              <Link to="/app/properties/lookup">Run your first lookup</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 grid grid-cols-[1fr_auto] gap-3 items-center">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{r.line1}</span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {[r.city, r.state, r.zip].filter(Boolean).join(", ") || "—"}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    <Badge variant="secondary">
                      {r.match_count} match{r.match_count === 1 ? "" : "es"}
                    </Badge>
                    {r.provider && (
                      <Badge variant="outline">
                        {r.used_fallback ? "sample data" : r.provider}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">{fmtDate(r.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate({
                        to: "/app/properties/lookup",
                        search: {
                          line1: r.line1,
                          city: r.city ?? "",
                          state: r.state ?? "",
                          zip: r.zip ?? "",
                        },
                      })
                    }
                  >
                    <Search className="mr-2 h-4 w-4" /> Re-run
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMut.mutate({ id: r.id })}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
