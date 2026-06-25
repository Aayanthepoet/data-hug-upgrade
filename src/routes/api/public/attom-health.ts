import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/attom-health")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.ATTOM_API_KEY ?? "";
        if (!key) {
          return Response.json({ ok: false, configured: false, reason: "ATTOM_API_KEY not set" });
        }
        try {
          const t0 = Date.now();
          const res = await fetch(
            "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot?postalcode=10001&pagesize=1",
            { headers: { apikey: key, Accept: "application/json" } },
          );
          const ms = Date.now() - t0;
          const text = await res.text();
          let parsed: unknown = null;
          try { parsed = JSON.parse(text); } catch { /* ignore */ }
          const total =
            parsed && typeof parsed === "object" && parsed !== null
              ? (parsed as { status?: { total?: number } }).status?.total ?? null
              : null;
          return Response.json({
            ok: res.ok,
            configured: true,
            status: res.status,
            latencyMs: ms,
            sampleTotal: total,
            keySuffix: key.slice(-4),
          });
        } catch (e) {
          return Response.json({
            ok: false,
            configured: true,
            reason: e instanceof Error ? e.message : "fetch failed",
          });
        }
      },
    },
  },
});
