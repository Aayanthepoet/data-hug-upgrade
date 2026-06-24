import { searchDistressedViaRouter } from "@/lib/distress/router.server";
(async () => {
  console.log("start");
  const r = await searchDistressedViaRouter({ state: "TX", minEquity: 1_000_000_000, limit: 50 });
  console.log("done", r.provider, r.usedFallback, r.records.length);
  process.exit(0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
