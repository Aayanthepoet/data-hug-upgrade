import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listActiveAuctions } from "@/lib/auctions/auctions.functions";
import { Gavel } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/auctions")({
  head: () => ({ meta: [{ title: "Auctions — PropAI" }] }),
  component: AuctionsPage,
  errorComponent: ({ error }) => <div className="p-6 text-red-400">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function AuctionsPage() {
  const fetchFn = useServerFn(listActiveAuctions);
  const { data, isLoading } = useQuery({
    queryKey: ["auctions", "active"],
    queryFn: () => fetchFn(),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h-display text-[clamp(28px,4vw,44px)]">Auctions</h1>
          <p className="text-[var(--w55)] text-sm mt-1">
            Live in-app auctions on saved properties. List one from any property's detail page.
          </p>
        </div>
      </header>

      {isLoading && <p className="text-[var(--w55)] text-sm">Loading…</p>}

      {!isLoading && (!data || data.length === 0) && (
        <div className="border border-border rounded-lg p-10 text-center">
          <Gavel className="mx-auto h-8 w-8 text-[var(--w55)]" />
          <p className="mt-3 text-sm text-[var(--w55)]">No active auctions yet.</p>
          <Link to="/app/properties" className="text-cyan text-sm mt-2 inline-block">
            Browse your saved properties →
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--w55)] text-xs uppercase tracking-widest">
              <tr>
                <th className="p-4">Title</th>
                <th className="p-4">Property</th>
                <th className="p-4">Current bid</th>
                <th className="p-4">Ends</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => {
                const prop = Array.isArray(a.properties) ? a.properties[0] : a.properties;
                return (
                  <tr key={a.id} className="border-t border-border hover:bg-[rgba(255,255,255,.02)]">
                    <td className="p-4">
                      <Link
                        to="/app/auctions/$auctionId"
                        params={{ auctionId: a.id }}
                        className="text-cyan hover:underline"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="p-4">
                      {prop ? `${prop.address}, ${prop.city ?? ""} ${prop.state ?? ""}` : "—"}
                    </td>
                    <td className="p-4">${Number(a.current_bid).toLocaleString()}</td>
                    <td className="p-4">{new Date(a.ends_at).toLocaleString()}</td>
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
