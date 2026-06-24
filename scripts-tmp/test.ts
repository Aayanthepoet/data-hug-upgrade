import { searchDistressedViaRouter } from "@/lib/distress/router.server";

async function run(label: string, filters: any) {
  try {
    const r = await searchDistressedViaRouter(filters);
    console.log(`[${label}] provider=${r.provider} usedFallback=${r.usedFallback} count=${r.records.length}`);
    if (r.records[0]) console.log("  sample:", r.records[0].address, "|", r.records[0].city, r.records[0].state, r.records[0].zip, "| type:", r.records[0].distressType, "equity:", r.records[0].equity);
  } catch (e: any) {
    console.log(`[${label}] ERROR ${e.message}`);
  }
}

(async () => {
  await run("NY broad", { state: "NY", limit: 50 });
  await run("NY preforeclosure", { state: "NY", distressTypes: ["preforeclosure"], limit: 50 });
  await run("TX huge equity (likely 0)", { state: "TX", minEquity: 1000000000, limit: 50 });
  await run("NY tax_lien +50k equity", { state: "NY", distressTypes: ["tax_lien"], minEquity: 50000, limit: 50 });
  await run("NY ZIP 10001", { state: "NY", zip: "10001", limit: 20 });
  await run("Impossible city", { state: "NY", city: "ZZZNoSuchCity", limit: 50 });
  await run("PA broad", { state: "PA", limit: 30 });
  await run("CA broad", { state: "CA", limit: 30 });
})();
