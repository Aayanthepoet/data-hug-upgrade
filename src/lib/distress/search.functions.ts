import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/billing/require-subscription.server";
import type { DistressType } from "./provider";

const distressTypeEnum = z.enum([
  "reo", "preforeclosure", "auction", "tax_lien",
  "tax_delinquent", "fsbo_stale", "vacant", "absentee",
  "hpd_litigation", "eviction", "vacate_order",
]);


const filtersSchema = z.object({
  state: z.string().trim().toUpperCase().length(2).optional(),
  county: z.string().trim().optional(),
  city: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  distressTypes: z.array(distressTypeEnum).optional(),
  minEquity: z.number().int().nonnegative().optional(),
  minDaysOnMarket: z.number().int().nonnegative().optional(),
  minListPrice: z.number().int().nonnegative().optional(),
  maxListPrice: z.number().int().nonnegative().optional(),
  minBeds: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export type DistressFilters = z.infer<typeof filtersSchema>;

function score(rec: {
  equity: number | null;
  estimatedValue: number | null;
  distressType: DistressType;
  daysOnMarket: number | null;
  isVacant: boolean;
  isAbsentee: boolean;
}): number {
  let s = 0;
  const eqPct = rec.estimatedValue && rec.equity
    ? rec.equity / rec.estimatedValue : 0;
  s += Math.round(eqPct * 40);
  if (rec.distressType === "preforeclosure" || rec.distressType === "auction") s += 30;
  else if (rec.distressType === "tax_lien" || rec.distressType === "tax_delinquent") s += 25;
  else if (rec.distressType === "reo") s += 20;
  else if (rec.distressType === "fsbo_stale") s += 15;
  if (rec.isVacant) s += 10;
  if (rec.isAbsentee) s += 5;
  if ((rec.daysOnMarket ?? 0) > 120) s += 5;
  return Math.min(100, s);
}

export const searchDistressedProperties = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((data: unknown) => filtersSchema.parse(data))
  .handler(async ({ data }) => {
    const { searchDistressedViaRouter } = await import("./router.server");
    const { records, provider, usedFallback } = await searchDistressedViaRouter(data);
    return {
      records: records.map((r) => ({
        ...r,
        leadScore: score(r),
        sourceProvider: r.sourceProvider ?? (usedFallback ? "mock" : provider),
      })),

      provider,
      usedFallback,
    };
  });

const importSchema = z.object({
  records: z.array(z.object({
    sourceRecordId: z.string(),
    sourceProvider: z.string(),
    address: z.string(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
    county: z.string().nullable(),
    propertyType: z.string().nullable(),
    beds: z.number().nullable(),
    baths: z.number().nullable(),
    sqft: z.number().nullable(),
    yearBuilt: z.number().nullable(),
    estimatedValue: z.number().nullable(),
    equity: z.number().nullable(),
    listPrice: z.number().nullable(),
    listDate: z.string().nullable(),
    daysOnMarket: z.number().nullable(),
    auctionDate: z.string().nullable(),
    taxOwed: z.number().nullable(),
    lienAmount: z.number().nullable(),
    distressType: distressTypeEnum,
    listingStatus: z.string().nullable(),
    isAbsentee: z.boolean(),
    isVacant: z.boolean(),
    leadScore: z.number().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
  })).min(1).max(200),
});

export const importDistressedProperties = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rows = data.records.map((r) => ({
      user_id: context.userId,
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
      listing_status: r.listingStatus as
        | "active" | "pending" | "sold" | "off_market"
        | "auction_scheduled" | "foreclosed" | null,
      is_absentee: r.isAbsentee,
      is_vacant: r.isVacant,
      is_preforeclosure: r.distressType === "preforeclosure",
      lead_score: r.leadScore ?? null,
      source_provider: r.sourceProvider,
      source_record_id: r.sourceRecordId,
      last_synced_at: new Date().toISOString(),
    }));

    const { data: inserted, error } = await context.supabase
      .from("properties")
      .upsert(rows, { onConflict: "user_id,source_provider,source_record_id" })
      .select("id, distress_type");
    if (error) throw new Error(error.message);

    // Log distress events
    if (inserted?.length) {
      const events = inserted
        .filter((p) => p.distress_type && p.distress_type !== "none")
        .map((p) => ({
          property_id: p.id,
          user_id: context.userId,
          event_type: p.distress_type,
          note: "Imported from distressed-property search",
        }));
      if (events.length) {
        await context.supabase.from("distress_events").insert(events);
      }
    }

    return {
      imported: inserted?.length ?? 0,
      ids: (inserted ?? []).map((p) => p.id),
    };
  });

const saveSearchSchema = z.object({
  name: z.string().min(1).max(120),
  filters: filtersSchema,
});

export const saveSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSearchSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("saved_searches")
      .insert({
        user_id: context.userId,
        name: data.name,
        filters: data.filters,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
