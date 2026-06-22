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

export type WatchlistStats = {
  watching: number;
  alertsToday: number;
  alertsThisWeek: number;
  alertsByType: { foreclosure: number; lis_pendens: number; deed_transfer: number };
};

export const getWatchlistStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchlistStats> => {
    const { supabase, userId } = context;

    const { data: items, error: itemsErr } = await supabase
      .from("watchlist_items")
      .select("property_key, alert_foreclosure, alert_lis_pendens, alert_deed_transfer")
      .eq("user_id", userId);
    if (itemsErr) throw new Error(itemsErr.message);

    const watching = items?.length ?? 0;
    const keys = (items ?? []).map((i) => i.property_key);
    const prefs = new Map(
      (items ?? []).map((i) => [
        i.property_key,
        {
          foreclosure: i.alert_foreclosure,
          lis_pendens: i.alert_lis_pendens,
          deed_transfer: i.alert_deed_transfer,
        },
      ]),
    );

    if (keys.length === 0) {
      return {
        watching: 0,
        alertsToday: 0,
        alertsThisWeek: 0,
        alertsByType: { foreclosure: 0, lis_pendens: 0, deed_transfer: 0 },
      };
    }

    // property_key in this app is the properties.id (uuid string).
    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const { data: events, error: evErr } = await supabase
      .from("distress_events")
      .select("property_id, event_type, created_at")
      .in("property_id", keys as string[])
      .gte("created_at", weekStart.toISOString());
    if (evErr) throw new Error(evErr.message);

    // Map DB event_type → preference key. Treat any unknown as a deed_transfer.
    const typeKey = (t: string): "foreclosure" | "lis_pendens" | "deed_transfer" => {
      const v = (t || "").toLowerCase();
      if (v.includes("foreclos")) return "foreclosure";
      if (v.includes("lis")) return "lis_pendens";
      return "deed_transfer";
    };

    let today = 0;
    let week = 0;
    const byType = { foreclosure: 0, lis_pendens: 0, deed_transfer: 0 };

    for (const e of events ?? []) {
      const pref = prefs.get(e.property_id as string);
      if (!pref) continue;
      const k = typeKey(e.event_type as string);
      if (!pref[k]) continue; // user disabled this alert type
      week += 1;
      byType[k] += 1;
      if (new Date(e.created_at as string) >= dayStart) today += 1;
    }

    return { watching, alertsToday: today, alertsThisWeek: week, alertsByType: byType };
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

export type AlertTrendPoint = {
  date: string; // YYYY-MM-DD
  foreclosure: number;
  lis_pendens: number;
  deed_transfer: number;
};

export const getAlertTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days: number }) =>
    z.object({ days: z.number().int().min(1).max(90) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AlertTrendPoint[]> => {
    const { supabase, userId } = context;
    const { data: items, error: iErr } = await supabase
      .from("watchlist_items")
      .select("property_key, alert_foreclosure, alert_lis_pendens, alert_deed_transfer")
      .eq("user_id", userId);
    if (iErr) throw new Error(iErr.message);

    const prefs = new Map(
      (items ?? []).map((i) => [
        i.property_key,
        {
          foreclosure: i.alert_foreclosure,
          lis_pendens: i.alert_lis_pendens,
          deed_transfer: i.alert_deed_transfer,
        },
      ]),
    );

    // Build empty buckets for the last N days.
    const buckets: AlertTrendPoint[] = [];
    const byDate = new Map<string, AlertTrendPoint>();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const p: AlertTrendPoint = { date: key, foreclosure: 0, lis_pendens: 0, deed_transfer: 0 };
      buckets.push(p);
      byDate.set(key, p);
    }

    if (prefs.size === 0) return buckets;

    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (data.days - 1));

    const { data: events, error: eErr } = await supabase
      .from("distress_events")
      .select("property_id, event_type, created_at")
      .in("property_id", Array.from(prefs.keys()))
      .gte("created_at", start.toISOString());
    if (eErr) throw new Error(eErr.message);

    const typeKey = (t: string): "foreclosure" | "lis_pendens" | "deed_transfer" => {
      const v = (t || "").toLowerCase();
      if (v.includes("foreclos")) return "foreclosure";
      if (v.includes("lis")) return "lis_pendens";
      return "deed_transfer";
    };

    for (const e of events ?? []) {
      const pref = prefs.get(e.property_id as string);
      if (!pref) continue;
      const k = typeKey(e.event_type as string);
      if (!pref[k]) continue;
      const day = (e.created_at as string).slice(0, 10);
      const bucket = byDate.get(day);
      if (bucket) bucket[k] += 1;
    }
    return buckets;
  });

export type AlertDayProperty = {
  property_key: string;
  address: string;
  city: string | null;
  state: string | null;
  events: { type: "foreclosure" | "lis_pendens" | "deed_transfer"; created_at: string; note: string | null; amount: number | null }[];
};

export const getAlertsForDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string }) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AlertDayProperty[]> => {
    const { supabase, userId } = context;
    const { data: items, error: iErr } = await supabase
      .from("watchlist_items")
      .select("property_key, address, city, state, alert_foreclosure, alert_lis_pendens, alert_deed_transfer")
      .eq("user_id", userId);
    if (iErr) throw new Error(iErr.message);
    if (!items || items.length === 0) return [];

    const start = new Date(data.date + "T00:00:00.000Z");
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const itemMap = new Map(items.map((i) => [i.property_key, i]));

    const { data: events, error: eErr } = await supabase
      .from("distress_events")
      .select("property_id, event_type, created_at, note, amount")
      .in("property_id", items.map((i) => i.property_key))
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (eErr) throw new Error(eErr.message);

    const typeKey = (t: string): "foreclosure" | "lis_pendens" | "deed_transfer" => {
      const v = (t || "").toLowerCase();
      if (v.includes("foreclos")) return "foreclosure";
      if (v.includes("lis")) return "lis_pendens";
      return "deed_transfer";
    };

    const grouped = new Map<string, AlertDayProperty>();
    for (const e of events ?? []) {
      const item = itemMap.get(e.property_id as string);
      if (!item) continue;
      const k = typeKey(e.event_type as string);
      const enabled =
        (k === "foreclosure" && item.alert_foreclosure) ||
        (k === "lis_pendens" && item.alert_lis_pendens) ||
        (k === "deed_transfer" && item.alert_deed_transfer);
      if (!enabled) continue;
      let row = grouped.get(item.property_key);
      if (!row) {
        row = {
          property_key: item.property_key,
          address: item.address,
          city: item.city,
          state: item.state,
          events: [],
        };
        grouped.set(item.property_key, row);
      }
      row.events.push({
        type: k,
        created_at: e.created_at as string,
        note: (e.note as string) ?? null,
        amount: (e.amount as number) ?? null,
      });
    }
    return Array.from(grouped.values());
  });
