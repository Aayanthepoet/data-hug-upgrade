import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const logSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
  zip: z.string().trim().max(10).optional().nullable(),
  matchCount: z.number().int().nonnegative(),
  provider: z.string().max(60).optional().nullable(),
  usedFallback: z.boolean().optional().default(false),
});

export const logLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => logSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lookup_history").insert({
      user_id: context.userId,
      line1: data.line1,
      city: data.city ?? null,
      state: data.state ? data.state.toUpperCase() : null,
      zip: data.zip ?? null,
      match_count: data.matchCount,
      provider: data.provider ?? null,
      used_fallback: data.usedFallback ?? false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLookupHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lookup_history")
      .select("id, line1, city, state, zip, match_count, provider, used_fallback, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteLookupHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("lookup_history").delete().eq("user_id", context.userId);
    if (data.id) q = q.eq("id", data.id);
    else if (!data.all) throw new Error("Specify id or all=true");
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
