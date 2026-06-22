// Scheduled close — pg_cron hits this every minute to close expired auctions
// using the service role (so it works regardless of who's signed in).
//
// Auth: requires the project's anon key in the `apikey` header.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/close-auctions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();

        const { data: expired, error } = await supabaseAdmin
          .from("auctions")
          .select("id")
          .eq("status", "active")
          .lt("ends_at", nowIso)
          .limit(500);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        let closed = 0;
        let sold = 0;
        for (const row of expired ?? []) {
          const { data: top } = await supabaseAdmin
            .from("bids")
            .select("id, bidder_id, amount")
            .eq("auction_id", row.id)
            .order("amount", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          const { error: uErr } = await supabaseAdmin
            .from("auctions")
            .update({
              status: top ? "sold" : "ended",
              winner_id: top?.bidder_id ?? null,
              winning_bid_id: top?.id ?? null,
              ended_at: nowIso,
            })
            .eq("id", row.id)
            .eq("status", "active");
          if (!uErr) { closed++; if (top) sold++; }
        }

        return new Response(JSON.stringify({ ok: true, closed, sold, scanned: expired?.length ?? 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
