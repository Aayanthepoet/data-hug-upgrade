import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: run the nightly NYC/Philly distress sync immediately. */
export const runDistressSyncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { runDistressSync } = await import("./sync.server");
    const summaries = await runDistressSync("manual");
    return { ok: true, summaries };
  });

export type SyncRunRow = {
  id: string;
  provider: string;
  started_at: string;
  finished_at: string | null;
  inserted: number;
  updated: number;
  skipped: number;
  error: string | null;
  triggered_by: string;
};

/** Admin-only: latest sync_runs rows (most recent first). */
export const getRecentSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncRunRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return [];

    const { data, error } = await context.supabase
      .from("sync_runs")
      .select("id, provider, started_at, finished_at, inserted, updated, skipped, error, triggered_by")
      .order("started_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (data ?? []) as SyncRunRow[];
  });
