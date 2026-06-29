// Per-provider distress sync hook. Each call runs exactly one provider in
// its own Worker request, so a slow/hung provider can't block the others.
// The orchestrator (sync.server.ts -> runDistressSync) fans out here.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-distressed-one")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const provided = request.headers.get("apikey") ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { provider?: string; triggeredBy?: "cron" | "manual" } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const provider = body.provider;
        const triggeredBy = body.triggeredBy === "manual" ? "manual" : "cron";
        if (!provider || typeof provider !== "string") {
          return new Response(JSON.stringify({ error: "Missing provider" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { runDistressSyncForProvider } = await import(
            "@/lib/distress/sync.server"
          );
          const summary = await runDistressSyncForProvider(provider, triggeredBy);
          return Response.json({ ok: true, summary });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[sync-distressed-one] failed:", e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
