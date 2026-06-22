import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlaceBidInput = z.object({
  auction_id: z.string().uuid(),
  amount: z.number().positive(),
});

export const placeBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlaceBidInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: auction, error: aErr } = await supabase
      .from("auctions")
      .select("id, status, current_bid, opening_bid, ends_at")
      .eq("id", data.auction_id).maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "live") throw new Error("Auction is not live");
    if (new Date(auction.ends_at) < new Date()) throw new Error("Auction has ended");

    const minBid = Math.max(auction.opening_bid, (auction.current_bid ?? 0) + 100);
    if (data.amount < minBid) {
      throw new Error(`Bid must be at least $${minBid.toLocaleString()}`);
    }

    // Live Engine fraud check: bid velocity by this user on this auction in last 10s
    const tenSecAgo = new Date(Date.now() - 10_000).toISOString();
    const { count: recentCount } = await supabase
      .from("bids").select("id", { count: "exact", head: true })
      .eq("auction_id", data.auction_id).eq("bidder_id", userId).gte("created_at", tenSecAgo);
    if ((recentCount ?? 0) >= 3) {
      throw new Error("Fraud protection: too many rapid bids — slow down");
    }

    // Insert bid + update auction current_bid
    const { error: bErr } = await supabase
      .from("bids").insert({ auction_id: data.auction_id, bidder_id: userId, amount: data.amount } as never);
    if (bErr) throw new Error(bErr.message);

    const { error: uErr } = await supabase
      .from("auctions").update({ current_bid: data.amount } as never).eq("id", data.auction_id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, new_current_bid: data.amount };
  });

const CreateAuctionInput = z.object({
  title: z.string().min(2).max(140),
  description: z.string().max(2000).optional(),
  opening_bid: z.number().positive(),
  duration_hours: z.number().int().min(1).max(168).default(24),
  property_id: z.string().uuid().nullable().optional(),
});

export const createAuction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateAuctionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const ends = new Date(now.getTime() + data.duration_hours * 3600_000);
    const { data: row, error } = await supabase.from("auctions").insert({
      user_id: userId,
      title: data.title,
      description: data.description ?? null,
      opening_bid: data.opening_bid,
      current_bid: data.opening_bid,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      status: "live",
      property_id: data.property_id ?? null,
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });
