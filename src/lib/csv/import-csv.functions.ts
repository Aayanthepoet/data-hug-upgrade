import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/billing/require-subscription.server";
import { mapRow, type TargetField } from "./mapping";

const TARGET = z.enum([
  "address","city","state","zip","owner_name","owner_mailing_address",
  "distress_type","estimated_value","beds","baths","notes",
]);

const inputSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(5000),
  mapping: z.record(TARGET, z.string()).refine((m) => !!m.address, {
    message: "Mapping must include an Address column",
  }),
});

export type ImportCsvResult = {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

const SOURCE = "user_csv";

export const importLeadsCsv = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<ImportCsvResult> => {
    const mapping = data.mapping as Partial<Record<TargetField, string>>;
    const errors: { row: number; reason: string }[] = [];
    const valid: { record: ReturnType<typeof mapRow> extends infer R ? Extract<R, { ok: true }>["record"] : never; rowIndex: number }[] = [];

    data.rows.forEach((row, idx) => {
      const m = mapRow(row, mapping);
      if (!m.ok) {
        errors.push({ row: idx + 2, reason: m.reason }); // +2 = header + 1-indexed
        return;
      }
      valid.push({ record: m.record, rowIndex: idx + 2 });
    });

    if (valid.length === 0) {
      return { total: data.rows.length, imported: 0, updated: 0, skipped: errors.length, errors };
    }

    // Dedupe within this upload — keep last occurrence of each source_record_id
    const dedup = new Map<string, typeof valid[0]>();
    for (const v of valid) dedup.set(v.record.source_record_id, v);
    const unique = Array.from(dedup.values());

    // Find existing rows for this user + provider to compute imported vs updated
    const sourceIds = unique.map((v) => v.record.source_record_id);
    const existing = new Set<string>();
    // Chunk the IN() to keep URL size sane
    for (let i = 0; i < sourceIds.length; i += 500) {
      const slice = sourceIds.slice(i, i + 500);
      const { data: rows, error } = await context.supabase
        .from("properties")
        .select("source_record_id")
        .eq("user_id", context.userId)
        .eq("source_provider", SOURCE)
        .in("source_record_id", slice);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) if (r.source_record_id) existing.add(r.source_record_id);
    }

    const now = new Date().toISOString();
    const upsertRows = unique.map((v) => ({
      user_id: context.userId,
      address: v.record.address,
      city: v.record.city,
      state: v.record.state,
      zip: v.record.zip,
      distress_type: v.record.distress_type,
      estimated_value: v.record.estimated_value,
      beds: v.record.beds,
      baths: v.record.baths,
      notes: v.record.notes,
      is_preforeclosure: v.record.distress_type === "preforeclosure",
      is_vacant: v.record.distress_type === "vacant",
      is_absentee: v.record.distress_type === "absentee",
      source_provider: SOURCE,
      source_record_id: v.record.source_record_id,
      last_synced_at: now,
    }));

    let upsertedCount = 0;
    for (let i = 0; i < upsertRows.length; i += 200) {
      const chunk = upsertRows.slice(i, i + 200);
      const { error, count } = await context.supabase
        .from("properties")
        .upsert(chunk, {
          onConflict: "user_id,source_provider,source_record_id",
          count: "exact",
        });
      if (error) {
        // Mark this chunk's rows as failed but continue
        for (const c of chunk) {
          const original = unique.find((v) => v.record.source_record_id === c.source_record_id);
          errors.push({ row: original?.rowIndex ?? 0, reason: `Upsert failed: ${error.message}` });
        }
        continue;
      }
      upsertedCount += count ?? chunk.length;
    }

    const updated = upsertRows.filter((r) => existing.has(r.source_record_id!)).length;
    const imported = Math.max(0, upsertedCount - updated);
    const skipped = data.rows.length - upsertedCount;

    return {
      total: data.rows.length,
      imported,
      updated,
      skipped: Math.max(skipped, errors.length),
      errors,
    };
  });
