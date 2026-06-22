import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { placeBid, createAuction } from "@/lib/engines/auctions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/auctions")({
  head: () => ({ meta: [{ title: "Auctions — PropAI Live Engine" }] }),
  component: AuctionsPage,
});

function AuctionsPage() {
  const bid = useServerFn(placeBid);
  const create = useServerFn(createAuction);
  const [title, setTitle] = useState("");
  const [opening, setOpening] = useState(50000);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});

  const { data: auctions, refetch } = useQuery({
    queryKey: ["auctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select("id, title, description, status, opening_bid, current_bid, ends_at, starts_at")
        .order("ends_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  async function onCreate() {
    if (!title.trim()) return toast.error("Title required");
    try {
      await create({ data: { title: title.trim(), opening_bid: opening, duration_hours: 24 } });
      setTitle(""); setOpening(50000);
      await refetch();
      toast.success("Auction created");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function onBid(id: string) {
    const amt = Number(bidAmounts[id]);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a bid amount");
    try {
      const res = await bid({ data: { auction_id: id, amount: amt } });
      toast.success(`Bid placed: $${res.new_current_bid.toLocaleString()}`);
      setBidAmounts((s) => ({ ...s, [id]: "" }));
      await refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bid failed"); }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Live Engine · real-time bidding · fraud detection</div>
        <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">Live <span className="h-italic">auctions</span></h1>
        <p className="text-[var(--w55)] mt-3 max-w-xl">Place bids in real time. Velocity-based fraud detection blocks &gt;3 bids per 10s from one bidder.</p>
      </div>

      <div className="surface p-4 grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
        <div>
          <label className="text-xs text-[var(--w55)]">New auction title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="123 Maple St — preforeclosure" />
        </div>
        <div>
          <label className="text-xs text-[var(--w55)]">Opening bid ($)</label>
          <Input type="number" value={opening} onChange={(e) => setOpening(Number(e.target.value))} />
        </div>
        <Button onClick={onCreate}>Start 24h auction</Button>
      </div>

      <div className="space-y-3">
        {(auctions ?? []).length === 0 && (
          <div className="surface p-6 text-sm text-[var(--w55)]">No auctions yet.</div>
        )}
        {(auctions ?? []).map((a) => {
          const ended = new Date(a.ends_at) < new Date();
          return (
            <div key={a.id} className="surface p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-[var(--w55)]">
                    Current: ${Number(a.current_bid ?? a.opening_bid).toLocaleString()} · Ends {new Date(a.ends_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant={ended ? "outline" : "default"}>{ended ? "ended" : a.status}</Badge>
              </div>
              {!ended && a.status === "live" && (
                <div className="mt-3 flex gap-2">
                  <Input
                    type="number"
                    placeholder={`Min $${(Number(a.current_bid ?? a.opening_bid) + 100).toLocaleString()}`}
                    value={bidAmounts[a.id] ?? ""}
                    onChange={(e) => setBidAmounts((s) => ({ ...s, [a.id]: e.target.value }))}
                  />
                  <Button onClick={() => onBid(a.id)}>Place bid</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
