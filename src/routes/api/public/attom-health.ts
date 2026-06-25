import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/attom-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.ATTOM_API_KEY ?? "";
        if (!key) {
          return Response.json({ ok: false, configured: false, reason: "ATTOM_API_KEY not set" });
        }
        const url = new URL(request.url);
        const zip = url.searchParams.get("zip") ?? "10001";
        const pagesize = url.searchParams.get("pagesize") ?? "3";
        try {
          const t0 = Date.now();
          const res = await fetch(
            `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot?postalcode=${encodeURIComponent(zip)}&pagesize=${encodeURIComponent(pagesize)}`,
            { headers: { apikey: key, Accept: "application/json" } },
          );
          const ms = Date.now() - t0;
          const text = await res.text();
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch { /* ignore */ }
          const total = parsed?.status?.total ?? null;
          const sample = (parsed?.property ?? []).slice(0, 3).map((p: any) => ({
            address: p?.address?.oneLine ?? null,
            city: p?.address?.locality ?? null,
            state: p?.address?.countrySubd ?? null,
            zip: p?.address?.postal1 ?? null,
            beds: p?.building?.rooms?.beds ?? null,
            baths: p?.building?.rooms?.bathstotal ?? null,
            sqft: p?.building?.size?.universalsize ?? null,
            yearBuilt: p?.summary?.yearbuilt ?? null,
            marketValue: p?.assessment?.market?.mktTtlValue ?? null,
            owner: p?.assessment?.owner?.owner1?.fullname ?? null,
            absentee: p?.summary?.absenteeInd ?? null,
          }));
          return Response.json({
            ok: res.ok,
            configured: true,
            status: res.status,
            latencyMs: ms,
            zip,
            sampleTotal: total,
            sample,
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
