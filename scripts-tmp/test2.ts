import { searchDistressedViaRouter } from "@/lib/distress/router.server";

async function run(label: string, filters: any) {
  const t = Date.now();
  try {
    const r = await Promise.race([
      searchDistressedViaRouter(filters),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout 15s")), 15000)),
    ]) as any;
    console.log(`[${label}] ${Date.now()-t}ms provider=${r.provider} fb=${r.usedFallback} count=${r.records.length}`);
  } catch (e: any) {
    console.log(`[${label}] ${Date.now()-t}ms ERROR ${e.message}`);
  }
}

(async () => {
  await run("Impossible-city no-results", { state: "NY", city: "ZZZNoSuchCity", limit: 50 });
  await run("TX min equity 1B (likely 0)", { state: "TX", minEquity: 1000000000, limit: 50 });
  await run("CA broad", { state: "CA", limit: 30 });
  await run("PA broad", { state: "PA", limit: 30 });
  await run("NY tax_lien 50k+", { state: "NY", distressTypes: ["tax_lien"], minEquity: 50000, limit: 50 });
  await run("NY zip 10001", { state: "NY", zip: "10001", limit: 20 });
})();
