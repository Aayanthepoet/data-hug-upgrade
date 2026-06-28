// One-shot bootstrap: reschedule the three cron jobs using CRON_SECRET as the
// `apikey` header value. Gated by CRON_SECRET itself so only an operator who
// already knows the value can trigger it.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/_reschedule-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        const provided = request.headers.get("apikey") ?? request.headers.get("x-cron-secret");
        if (!cronSecret || provided !== cronSecret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("reschedule_distress_cron_jobs", {
          _apikey: cronSecret,
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, jobs: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
