// Nightly distress-data sync.
// - Reuses NYCOpenDataProvider + PhillyCartoProvider (free sources only).
// - Upserts into public.properties keyed on (user_id, source_provider, source_record_id).
// - The partial unique index `idx_properties_source_unique` only covers rows
//   WHERE source_provider IS NOT NULL AND source_record_id IS NOT NULL, so
//   manually-entered rows (source_provider NULL) are NEVER touched by upserts.
// - Records a row in public.sync_runs per provider per run.
//
// Execution model:
//   Each provider runs in its OWN Worker request via the
//   /api/public/hooks/sync-distressed-one fan-out hook. One slow/hung provider
//   (e.g. HPD Litigations) cannot block the others. Per-provider wall-clock
//   budget is enforced with PROVIDER_TIMEOUT_MS.

import { NYCOpenDataProvider } from "./nyc-provider.server";
import { fetchNYCSignal } from "./nyc-signals-provider.server";
import { fetchPhillySignal } from "./philly-signals-provider.server";
import { SYNC_TARGETS, PER_TARGET_LIMIT, type SyncTarget } from "./sync-config";
import type { DistressedPropertyRecord } from "./provider";

const PROVIDER_TIMEOUT_MS = 50_000;
const FANOUT_CONCURRENCY = 4;

const STABLE_BASE_URL =
  "https://project--f060fcf2-0071-41a6-8014-e8dd9520d418.lovable.app";

async function getAdminClient() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

type SupabaseAdmin = Awaited<ReturnType<typeof getAdminClient>>;

/** First admin user — synced rows are owned by this account. */
async function resolveSyncOwnerId(admin: SupabaseAdmin): Promise<string> {
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("user_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`sync: cannot resolve admin owner: ${error.message}`);
  if (!data?.user_id) throw new Error("sync: no admin user exists to own synced rows");
  return data.user_id;
}

function recordToRow(
  ownerId: string,
  providerName: string,
  r: DistressedPropertyRecord,
) {
  return {
    user_id: ownerId,
    source_provider: providerName,
    source_record_id: r.sourceRecordId,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    county: r.county,
    property_type: r.propertyType,
    beds: r.beds,
    baths: r.baths,
    sqft: r.sqft,
    year_built: r.yearBuilt,
    estimated_value: r.estimatedValue,
    equity: r.equity,
    list_price: r.listPrice,
    list_date: r.listDate,
    days_on_market: r.daysOnMarket,
    auction_date: r.auctionDate,
    tax_owed: r.taxOwed,
    lien_amount: r.lienAmount,
    distress_type: r.distressType,
    listing_status: r.listingStatus,
    is_preforeclosure: r.distressType === "preforeclosure",
    is_vacant: r.isVacant,
    is_absentee: r.isAbsentee,
    last_synced_at: new Date().toISOString(),
  };
}

async function fetchForTarget(t: SyncTarget): Promise<DistressedPropertyRecord[]> {
  if (t.provider === "nyc_opendata") {
    const provider = new NYCOpenDataProvider();
    return provider.searchDistressed({
      state: "NY",
      zip: t.zip,
      county: t.borough,
      limit: PER_TARGET_LIMIT,
    });
  }
  if (t.provider.startsWith("phl_")) {
    return fetchPhillySignal(
      t.provider as Parameters<typeof fetchPhillySignal>[0],
      t.zip,
      PER_TARGET_LIMIT,
    );
  }
  // NYC Distress Signals
  return fetchNYCSignal(
    t.provider as Parameters<typeof fetchNYCSignal>[0],
    t.zip,
    PER_TARGET_LIMIT,
  );
}

export type SyncSummary = {
  provider: string;
  inserted: number;
  updated: number;
  skipped: number;
  error: string | null;
  startedAt: string;
  finishedAt: string;
};

function listProviders(): string[] {
  const set = new Set<string>();
  for (const t of SYNC_TARGETS) set.add(t.provider);
  return Array.from(set);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return (
      [o.message, o.details, o.hint, o.code].filter(Boolean).join(" | ") ||
      JSON.stringify(o)
    );
  }
  return String(e);
}

/** Run a SINGLE provider end-to-end in this Worker request. */
export async function runDistressSyncForProvider(
  provider: string,
  triggeredBy: "cron" | "manual",
): Promise<SyncSummary> {
  const admin = await getAdminClient();
  const ownerId = await resolveSyncOwnerId(admin);
  const targets = SYNC_TARGETS.filter((t) => t.provider === provider);
  if (targets.length === 0) {
    const now = new Date().toISOString();
    return {
      provider,
      inserted: 0,
      updated: 0,
      skipped: 0,
      error: "unknown provider",
      startedAt: now,
      finishedAt: now,
    };
  }

  const startedAt = new Date().toISOString();
  const { data: runRow, error: runErr } = await admin
    .from("sync_runs")
    .insert({ provider, started_at: startedAt, triggered_by: triggeredBy })
    .select("id")
    .single();
  if (runErr) {
    return {
      provider,
      inserted: 0,
      updated: 0,
      skipped: 0,
      error: `Could not record run: ${runErr.message}`,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errorMsg: string | null = null;

  const work = (async () => {
    const rows = new Map<string, DistressedPropertyRecord>();
    for (const t of targets) {
      try {
        const records = await withTimeout(
          fetchForTarget(t),
          PROVIDER_TIMEOUT_MS - 5_000,
          `${provider}/${t.zip} fetch`,
        );
        for (const r of records) {
          if (!r.sourceRecordId || !r.address) {
            skipped++;
            continue;
          }
          if (!rows.has(r.sourceRecordId)) rows.set(r.sourceRecordId, r);
        }
      } catch (e) {
        console.error(`[sync] fetch failed for ${provider} ${t.zip}:`, e);
      }
    }

    const allIds = Array.from(rows.keys());

    const existingSet = new Set<string>();
    const ID_CHUNK = 100;
    for (let i = 0; i < allIds.length; i += ID_CHUNK) {
      const idSlice = allIds.slice(i, i + ID_CHUNK);
      const { data: existing, error: existErr } = await admin
        .from("properties")
        .select("source_record_id")
        .eq("user_id", ownerId)
        .eq("source_provider", provider)
        .in("source_record_id", idSlice);
      if (existErr) throw existErr;
      for (const r of existing ?? []) {
        if (r.source_record_id) existingSet.add(r.source_record_id);
      }
    }

    const payload = Array.from(rows.values()).map((r) => recordToRow(ownerId, provider, r));
    const CHUNK = 200;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const slice = payload.slice(i, i + CHUNK);
      const { error: upErr } = await admin
        .from("properties")
        .upsert(slice, {
          onConflict: "user_id,source_provider,source_record_id",
          ignoreDuplicates: false,
        });
      if (upErr) throw upErr;
    }

    for (const id of allIds) {
      if (existingSet.has(id)) updated++;
      else inserted++;
    }
  })();

  try {
    await withTimeout(work, PROVIDER_TIMEOUT_MS, `${provider} run`);
  } catch (e) {
    errorMsg = errMessage(e);
    console.error(`[sync] provider ${provider} failed:`, e);
  }

  const finishedAt = new Date().toISOString();
  await admin
    .from("sync_runs")
    .update({
      finished_at: finishedAt,
      inserted,
      updated,
      skipped,
      error: errorMsg,
    })
    .eq("id", runRow.id);

  return { provider, inserted, updated, skipped, error: errorMsg, startedAt, finishedAt };
}

/** Orchestrator: fan out one Worker request per provider. */
export async function runDistressSync(
  triggeredBy: "cron" | "manual",
): Promise<SyncSummary[]> {
  const secret = process.env.CRON_SECRET;
  const providers = listProviders();

  // If we can't fan out (missing secret), fall back to inline sequential
  // execution so the call still works in any environment.
  if (!secret) {
    const out: SyncSummary[] = [];
    for (const p of providers) {
      out.push(await runDistressSyncForProvider(p, triggeredBy));
    }
    return out;
  }

  const url = `${STABLE_BASE_URL}/api/public/hooks/sync-distressed-one`;
  const results: Array<SyncSummary & { ranVia: "hook" | "fallback" }> = [];
  const queue = [...providers];

  const RETRY_DELAYS_MS = [2000, 5000]; // 3 attempts total
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function callHookOnce(p: string): Promise<
    | { ok: true; summary: SyncSummary }
    | { ok: false; retriable: boolean; error: string }
  > {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: secret! },
        body: JSON.stringify({ provider: p, triggeredBy }),
      });
      const text = await resp.text();
      if (resp.status === 404) {
        return { ok: false, retriable: true, error: `HTTP 404: ${text.slice(0, 200)}` };
      }
      if (!resp.ok) {
        return {
          ok: false,
          retriable: false,
          error: `fan-out HTTP ${resp.status}: ${text.slice(0, 300)}`,
        };
      }
      try {
        const json = JSON.parse(text) as { summary?: SyncSummary };
        if (json.summary) return { ok: true, summary: json.summary };
        return { ok: false, retriable: false, error: "fan-out: missing summary" };
      } catch {
        return {
          ok: false,
          retriable: false,
          error: `fan-out: invalid JSON: ${text.slice(0, 200)}`,
        };
      }
    } catch (e) {
      return { ok: false, retriable: true, error: `network: ${errMessage(e)}` };
    }
  }

  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      if (!p) return;
      const startedAt = new Date().toISOString();

      let lastError = "";
      let hookSummary: SyncSummary | null = null;
      for (let attempt = 0; attempt < 1 + RETRY_DELAYS_MS.length; attempt++) {
        const res = await callHookOnce(p);
        if (res.ok) {
          hookSummary = res.summary;
          break;
        }
        lastError = res.error;
        if (!res.retriable) break;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay == null) break;
        console.warn(`[sync] hook ${p} attempt ${attempt + 1} failed (${res.error}); retrying in ${delay}ms`);
        await sleep(delay);
      }

      if (hookSummary) {
        results.push({ ...hookSummary, ranVia: "hook" });
        continue;
      }

      // Fallback: run in-process so the provider still completes.
      console.warn(`[sync] hook ${p} failed after retries (${lastError}); running in-process fallback`);
      try {
        const summary = await runDistressSyncForProvider(p, triggeredBy);
        const mergedError = summary.error
          ? `${summary.error} | hook fallback after: ${lastError}`
          : `ran via in-process fallback after hook error: ${lastError}`;
        results.push({ ...summary, error: mergedError, ranVia: "fallback" });
      } catch (e) {
        results.push({
          provider: p,
          inserted: 0,
          updated: 0,
          skipped: 0,
          error: `fallback failed: ${errMessage(e)} | hook error: ${lastError}`,
          startedAt,
          finishedAt: new Date().toISOString(),
          ranVia: "fallback",
        });
      }
    }
  }


  const workers = Array.from({ length: Math.min(FANOUT_CONCURRENCY, providers.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
