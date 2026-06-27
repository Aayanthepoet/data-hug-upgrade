// Nightly distress-data sync.
// - Reuses NYCOpenDataProvider + PhillyCartoProvider (free sources only).
// - Upserts into public.properties keyed on (user_id, source_provider, source_record_id).
// - The partial unique index `idx_properties_source_unique` only covers rows
//   WHERE source_provider IS NOT NULL AND source_record_id IS NOT NULL, so
//   manually-entered rows (source_provider NULL) are NEVER touched by upserts.
// - Records a row in public.sync_runs per provider per run.

import { NYCOpenDataProvider } from "./nyc-provider.server";
import { PhillyCartoProvider } from "./philly-provider.server";
import { SYNC_TARGETS, PER_TARGET_LIMIT, type SyncTarget } from "./sync-config";
import type { DistressedPropertyRecord } from "./provider";

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
  const provider = new PhillyCartoProvider();
  return provider.searchDistressed({
    state: "PA",
    zip: t.zip,
    city: "Philadelphia",
    limit: PER_TARGET_LIMIT,
  });
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

export async function runDistressSync(
  triggeredBy: "cron" | "manual",
): Promise<SyncSummary[]> {
  const admin = await getAdminClient();
  const ownerId = await resolveSyncOwnerId(admin);

  // Group targets by provider so we get one sync_runs row per provider per run.
  const byProvider = new Map<string, SyncTarget[]>();
  for (const t of SYNC_TARGETS) {
    const arr = byProvider.get(t.provider) ?? [];
    arr.push(t);
    byProvider.set(t.provider, arr);
  }

  const summaries: SyncSummary[] = [];

  for (const [provider, targets] of byProvider) {
    const startedAt = new Date().toISOString();
    const { data: runRow, error: runErr } = await admin
      .from("sync_runs")
      .insert({ provider, started_at: startedAt, triggered_by: triggeredBy })
      .select("id")
      .single();
    if (runErr) {
      summaries.push({
        provider,
        inserted: 0,
        updated: 0,
        skipped: 0,
        error: `Could not record run: ${runErr.message}`,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      continue;
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errorMsg: string | null = null;

    try {
      // Collect all records, dedupe by sourceRecordId.
      const rows = new Map<string, DistressedPropertyRecord>();
      for (const t of targets) {
        try {
          const records = await fetchForTarget(t);
          for (const r of records) {
            if (!r.sourceRecordId || !r.address) {
              skipped++;
              continue;
            }
            if (!rows.has(r.sourceRecordId)) rows.set(r.sourceRecordId, r);
          }
        } catch (e) {
          console.error(`[sync] fetch failed for ${provider} ${t.zip}:`, e);
          // partial failure — keep going
        }
      }

      const allIds = Array.from(rows.keys());
      const { data: existing, error: existErr } = await admin
        .from("properties")
        .select("source_record_id")
        .eq("user_id", ownerId)
        .eq("source_provider", provider)
        .in("source_record_id", allIds);
      if (existErr) throw existErr;
      const existingSet = new Set((existing ?? []).map((r) => r.source_record_id));

      const payload = Array.from(rows.values()).map((r) => recordToRow(ownerId, provider, r));

      // Chunk upserts to keep payloads small.
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        errorMsg = e.message;
      } else if (e && typeof e === "object") {
        const o = e as Record<string, unknown>;
        errorMsg = [o.message, o.details, o.hint, o.code]
          .filter(Boolean)
          .join(" | ") || JSON.stringify(o);
      } else {
        errorMsg = String(e);
      }
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

    summaries.push({ provider, inserted, updated, skipped, error: errorMsg, startedAt, finishedAt });
  }

  return summaries;
}
