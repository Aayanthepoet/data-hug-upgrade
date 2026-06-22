import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getAuction, placeBid } from "@/lib/auctions/auctions.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/auctions/$auctionId")({
  head: () => ({ meta: [{ title: "Auction — PropAI" }] }),
  component: AuctionDetail,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">Couldn't load auction</h1>
        <p className="text-sm text-[var(--w55)]">{error.message}</p>
        <button className="text-cyan text-sm" onClick={() => { reset(); router.invalidate(); }}>Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Auction not found.</div>,
});

function AuctionDetail() {
  const { auctionId } = Route.useParams();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAuction);
  const bidFn = useServerFn(placeBid);

  const { data, isLoading, error } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => fetchFn({ data: { id: auctionId } }),
  });

  // Realtime: refetch when a new bid lands or current_bid updates.
  useEffect(() => {
    const ch = supabase
      .channel(`auction-${auctionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${auctionId}` },
        () => qc.invalidateQueries({ queryKey: ["auction", auctionId] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` },
        () => qc.invalidateQueries({ queryKey: ["auction", auctionId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [auctionId, qc]);

  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (n: number) => bidFn({ data: { auctionId, amount: n } }),
    onSuccess: () => { setAmount(""); setErr(null); qc.invalidateQueries({ queryKey: ["auction", auctionId] }); },
    onError: (e: Error) => setErr(e.message),
  });

  if (isLoading) return <div className="text-[var(--w55)]">Loading…</div>;
  if (error) return <div className="text-red-400">{(error as Error).message}</div>;
  if (!data) return null;

  const { auction, bids, viewerId } = data;
  const prop = Array.isArray(auction.properties) ? auction.properties[0] : auction.properties;
  const isOwner = auction.user_id === viewerId;
  const ended = new Date(auction.ends_at).getTime() <= Date.now();
  const minBid = Number(auction.current_bid) + 1;

  return (
    <div className="space-y-6">
      <Link to="/app/auctions" className="inline-flex items-center gap-1 text-xs text-[var(--w55)] hover:text-white">
        <ArrowLeft className="h-3 w-3" /> All auctions
      </Link>

      <header>
        <h1 className="text-3xl font-bold">{auction.title}</h1>
        {prop && (
          <p className="text-[var(--w55)] mt-1">
            <Link to="/app/properties/$propertyId" params={{ propertyId: auction.property_id! }} className="text-cyan hover:underline">
              {prop.address}
            </Link>
            {", "}{prop.city} {prop.state} {prop.zip}
          </p>
        )}
        {auction.description && <p className="mt-3 text-sm">{auction.description}</p>}
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Current bid" value={`$${Number(auction.current_bid).toLocaleString()}`} />
        <Stat label="Opening" value={`$${Number(auction.opening_bid).toLocaleString()}`} />
        <Stat label="Ends" value={new Date(auction.ends_at).toLocaleString()} />
        <Stat label="Status" value={ended ? "ended" : auction.status} />
      </section>

      {!isOwner && !ended && auction.status === "active" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount);
            if (!n || n < minBid) { setErr(`Enter at least $${minBid.toLocaleString()}`); return; }
            mut.mutate(n);
          }}
          className="surface p-4 flex items-end gap-3 flex-wrap"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Your bid (min ${minBid.toLocaleString()})</label>
            <input
              type="number"
              min={minBid}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(minBid)}
              className="w-full mt-1 px-3 py-2 bg-[rgba(255,255,255,.04)] border border-border rounded focus:outline-none focus:border-cyan"
            />
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="px-4 py-2 rounded-md bg-cyan text-black text-sm font-medium disabled:opacity-50"
          >
            {mut.isPending ? "Placing…" : "Place bid"}
          </button>
          {err && <p className="basis-full text-red-400 text-xs">{err}</p>}
        </form>
      )}

      {isOwner && <p className="text-xs text-[var(--w55)]">You own this auction — bidding disabled.</p>}
      {ended && <p className="text-xs text-amber-400">This auction has ended.</p>}

      <section>
        <h2 className="text-xs uppercase tracking-wider text-[var(--w55)] mb-3">Bid activity</h2>
        {bids.length === 0 ? (
          <p className="text-sm text-[var(--w55)]">No bids yet — be the first.</p>
        ) : (
          <ol className="border border-border rounded-md divide-y divide-border">
            {bids.map((b) => (
              <li key={b.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-mono text-cyan">${Number(b.amount).toLocaleString()}</span>
                <span className="text-[var(--w55)] text-xs">
                  {b.bidder_id === viewerId ? "You" : `Bidder ${b.bidder_id.slice(0, 6)}`}
                  {" · "}
                  {new Date(b.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
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
