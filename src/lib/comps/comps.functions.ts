import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/billing/require-subscription.server";
import { z } from "zod";

const propertyIdInput = z.object({ propertyId: z.string().uuid() });

export interface CompRow {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  sale_price: number;
  sale_date: string;
  distance_miles: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  year_built: number | null;
  similarity_score: number | null;
  source_provider: string;
}

export interface ArvEstimateRow {
  arv: number;
  arv_low: number;
  arv_high: number;
  price_per_sqft: number | null;
  comp_count: number;
  confidence: number;
  method: string;
  computed_at: string;
}

export interface CompsResult {
  comps: CompRow[];
  arv: ArvEstimateRow | null;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export const getComps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { propertyId: string }) => propertyIdInput.parse(d))
  .handler(async ({ data, context }): Promise<CompsResult> => {
    const { supabase, userId } = context;
    const [{ data: comps }, { data: arv }] = await Promise.all([
      supabase
        .from("comps")
        .select("id,address,city,state,zip,sale_price,sale_date,distance_miles,sqft,beds,baths,year_built,similarity_score,source_provider")
        .eq("subject_property_id", data.propertyId)
        .eq("user_id", userId)
        .order("similarity_score", { ascending: false })
        .limit(20),
      supabase
        .from("arv_estimates")
        .select("arv,arv_low,arv_high,price_per_sqft,comp_count,confidence,method,computed_at")
        .eq("property_id", data.propertyId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return {
      comps: (comps ?? []) as CompRow[],
      arv: (arv ?? null) as ArvEstimateRow | null,
    };
  });

export const runComps = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((d: { propertyId: string }) => propertyIdInput.parse(d))
  .handler(async ({ data, context }): Promise<CompsResult> => {
    const { supabase, userId } = context;

    // Load subject property (RLS scopes to user)
    const { data: subject, error: subjErr } = await supabase
      .from("properties")
      .select("id,address,city,state,zip,beds,baths,sqft,year_built,property_type")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (subjErr) throw new Error(subjErr.message);
    if (!subject) throw new Error("Property not found");

    const { mockCompsProvider } = await import("./mock-provider.server");
    const records = await mockCompsProvider.fetchComps(
      {
        id: subject.id,
        address: subject.address,
        city: subject.city,
        state: subject.state,
        zip: subject.zip,
        beds: subject.beds ? Number(subject.beds) : null,
        baths: subject.baths ? Number(subject.baths) : null,
        sqft: subject.sqft,
        year_built: subject.year_built,
        property_type: subject.property_type,
      },
      8,
    );

    // Replace existing comps for this subject
    await supabase
      .from("comps")
      .delete()
      .eq("subject_property_id", data.propertyId)
      .eq("user_id", userId);

    if (records.length > 0) {
      const rows = records.map((r) => ({
        user_id: userId,
        subject_property_id: data.propertyId,
        ...r,
      }));
      const { error: insErr } = await supabase.from("comps").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    // Compute ARV from median price-per-sqft of top comps
    const subjectSqft = subject.sqft ?? null;
    const ppsfs = records
      .filter((r) => r.sqft > 0)
      .map((r) => r.sale_price / r.sqft);
    const medianPpsf = median(ppsfs);
    const lowPpsf = ppsfs.length ? Math.min(...ppsfs) : 0;
    const highPpsf = ppsfs.length ? Math.max(...ppsfs) : 0;

    const arv = subjectSqft && medianPpsf
      ? Math.round((subjectSqft * medianPpsf) / 1000) * 1000
      : 0;
    const arv_low = subjectSqft && lowPpsf
      ? Math.round((subjectSqft * lowPpsf) / 1000) * 1000
      : 0;
    const arv_high = subjectSqft && highPpsf
      ? Math.round((subjectSqft * highPpsf) / 1000) * 1000
      : 0;

    // Confidence: based on comp count + similarity
    const avgSim = records.length
      ? records.reduce((s, r) => s + r.similarity_score, 0) / records.length
      : 0;
    const confidence = Math.min(99, Math.round(avgSim * 0.7 + records.length * 4));

    const arvRow = {
      user_id: userId,
      property_id: data.propertyId,
      arv,
      arv_low,
      arv_high,
      price_per_sqft: medianPpsf ? Math.round(medianPpsf * 100) / 100 : null,
      comp_count: records.length,
      confidence,
      method: "ppsf_median",
      computed_at: new Date().toISOString(),
    };

    const { error: arvErr } = await supabase
      .from("arv_estimates")
      .upsert(arvRow, { onConflict: "property_id" });
    if (arvErr) throw new Error(arvErr.message);

    // Return refreshed view
    const { data: storedComps } = await supabase
      .from("comps")
      .select("id,address,city,state,zip,sale_price,sale_date,distance_miles,sqft,beds,baths,year_built,similarity_score,source_provider")
      .eq("subject_property_id", data.propertyId)
      .eq("user_id", userId)
      .order("similarity_score", { ascending: false });

    return {
      comps: (storedComps ?? []) as CompRow[],
      arv: {
        arv: arvRow.arv,
        arv_low: arvRow.arv_low,
        arv_high: arvRow.arv_high,
        price_per_sqft: arvRow.price_per_sqft,
        comp_count: arvRow.comp_count,
        confidence: arvRow.confidence,
        method: arvRow.method,
        computed_at: arvRow.computed_at,
      },
    };
  });
