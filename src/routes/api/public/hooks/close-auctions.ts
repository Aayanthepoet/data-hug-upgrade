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
        const { data: closed, error } = await supabaseAdmin
          .rpc("close_expired_auctions", { _limit: 500 });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, closed: closed ?? 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
