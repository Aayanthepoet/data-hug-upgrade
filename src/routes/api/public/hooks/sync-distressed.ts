// Nightly cron endpoint for the free NYC/Philly distress sync.
// pg_cron calls this with the project's anon key in the `apikey` header.
// /api/public/* bypasses auth at the edge, so we verify the apikey here.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-distressed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        const provided = request.headers.get("apikey") ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { runDistressSync } = await import("@/lib/distress/sync.server");
          const summaries = await runDistressSync("cron");
          return Response.json({ ok: true, summaries });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[sync-distressed] failed:", e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
