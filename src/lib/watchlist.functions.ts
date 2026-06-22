import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WatchlistItem = {
  id: string;
  property_key: string;
  address: string;
  city: string | null;
  state: string | null;
  county: string | null;
  alert_foreclosure: boolean;
  alert_lis_pendens: boolean;
  alert_deed_transfer: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const listWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watchlist_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as WatchlistItem[];
  });

const upsertSchema = z.object({
  property_key: z.string().min(1).max(200),
  address: z.string().min(1).max(300),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(20).optional().nullable(),
  county: z.string().max(120).optional().nullable(),
  alert_foreclosure: z.boolean().default(true),
  alert_lis_pendens: z.boolean().default(true),
  alert_deed_transfer: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

export const upsertWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof upsertSchema>) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("watchlist_items")
      .upsert(
        { ...data, user_id: context.userId },
        { onConflict: "user_id,property_key" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as WatchlistItem;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  alert_foreclosure: z.boolean().optional(),
  alert_lis_pendens: z.boolean().optional(),
  alert_deed_transfer: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof updateSchema>) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("watchlist_items")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as WatchlistItem;
  });

export const deleteWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
