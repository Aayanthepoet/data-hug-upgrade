// In-app wholesale auctions. Each auction references a saved property
// (public.properties.id). Bids are atomic: placeBid only succeeds if the
// new amount is strictly greater than the current_bid we read.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional().nullable(),
  openingBid: z.number().positive(),
  endsAt: z.string().min(10), // ISO timestamp
});

export const createAuction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the property exists and is visible to this user (RLS handles it).
    const { data: prop, error: pErr } = await supabase
      .from("properties")
      .select("id, address")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Property not found or not accessible");

    const { data: row, error } = await supabase
      .from("auctions")
      .insert({
        user_id: userId,
        property_id: data.propertyId,
        title: data.title,
        description: data.description ?? null,
        opening_bid: data.openingBid,
        current_bid: data.openingBid,
        starts_at: new Date().toISOString(),
        ends_at: data.endsAt,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listActiveAuctions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Close any expired auctions before listing.
    await closeExpired(context.supabase);
    const { data, error } = await context.supabase
      .from("auctions")
      .select("id, title, current_bid, opening_bid, ends_at, status, property_id, properties(address, city, state)")
      .eq("status", "active")
      .order("ends_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAuction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Close this auction if it has expired before reading it.
    await closeIfExpired(context.supabase, data.id);
    const { data: a, error } = await context.supabase
      .from("auctions")
      .select(
        "id, title, description, opening_bid, current_bid, starts_at, ends_at, status, user_id, property_id, properties(address, city, state, zip, estimated_value)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!a) throw new Error("Auction not found");

    const { data: bids, error: bErr } = await context.supabase
      .from("bids")
      .select("id, amount, bidder_id, created_at")
      .eq("auction_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (bErr) throw new Error(bErr.message);

    return { auction: a, bids: bids ?? [], viewerId: context.userId };
  });

export const placeBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ auctionId: z.string().uuid(), amount: z.number().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: a, error: aErr } = await supabase
      .from("auctions")
      .select("id, user_id, current_bid, ends_at, status")
      .eq("id", data.auctionId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!a) throw new Error("Auction not found");
    if (a.status !== "active") throw new Error("Auction is not active");
    if (new Date(a.ends_at).getTime() <= Date.now()) throw new Error("Auction has ended");
    if (a.user_id === userId) throw new Error("You can't bid on your own auction");
    if (data.amount <= Number(a.current_bid)) {
      throw new Error(`Bid must be greater than current $${Number(a.current_bid).toLocaleString()}`);
    }

    // Atomic-ish update: only succeeds if current_bid hasn't moved past us.
    const { data: updated, error: uErr } = await supabase
      .from("auctions")
      .update({ current_bid: data.amount })
      .eq("id", data.auctionId)
      .eq("current_bid", a.current_bid)
      .select("id")
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    if (!updated) throw new Error("Someone outbid you — refresh and try again");

    const { error: bErr } = await supabase
      .from("bids")
      .insert({ auction_id: data.auctionId, bidder_id: userId, amount: data.amount });
    if (bErr) throw new Error(bErr.message);

    return { ok: true, currentBid: data.amount };
  });

// ---------- auto-close helpers ----------

async function closeAuctionRow(supabase: any, auctionId: string) {
  // Find top bid (if any).
  const { data: top } = await supabase
    .from("bids")
    .select("id, bidder_id, amount")
    .eq("auction_id", auctionId)
    .order("amount", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("auctions")
    .update({
      status: top ? "sold" : "ended",
      winner_id: top?.bidder_id ?? null,
      winning_bid_id: top?.id ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", auctionId)
    .eq("status", "active"); // only flip if still active
}

async function closeIfExpired(supabase: any, auctionId: string): Promise<void> {
  const { data: a } = await supabase
    .from("auctions")
    .select("id, status, ends_at")
    .eq("id", auctionId)
    .maybeSingle();
  if (!a) return;
  if (a.status !== "active") return;
  if (new Date(a.ends_at).getTime() > Date.now()) return;
  await closeAuctionRow(supabase, auctionId);
}

async function closeExpired(supabase: any): Promise<void> {
  const { data: expired } = await supabase
    .from("auctions")
    .select("id")
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString())
    .limit(50);
  if (!expired?.length) return;
  await Promise.all(expired.map((r: { id: string }) => closeAuctionRow(supabase, r.id)));
}
