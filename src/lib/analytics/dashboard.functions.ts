import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardAnalytics = {
  owners: { total: number; traced: number; pending: number; successRate: number };
  contacts: { total: number; verified: number };
  exports: {
    last30Days: number;
    totalRecords: number;
    daily: { date: string; count: number; records: number }[];
  };
  skipTraces: {
    last30Days: number;
    daily: { date: string; count: number }[];
  };
};

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardAnalytics> => {
    const { supabase, userId } = context;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 29);
    since.setUTCHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    const [ownersTotal, ownersTraced, contactsTotal, contactsVerified, auditRows] =
      await Promise.all([
        supabase.from("owners").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("owners")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("skip_trace_status", "traced"),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_verified", true),
        supabase
          .from("audit_logs")
          .select("action,record_count,created_at")
          .eq("user_id", userId)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: true }),
      ]);

    const ownersT = ownersTotal.count ?? 0;
    const ownersTr = ownersTraced.count ?? 0;
    const successRate = ownersT > 0 ? ownersTr / ownersT : 0;

    // Build 30-day buckets
    const exportsDaily = new Map<string, { count: number; records: number }>();
    const skipDaily = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = isoDay(d);
      exportsDaily.set(key, { count: 0, records: 0 });
      skipDaily.set(key, 0);
    }

    let exportCount = 0;
    let exportRecords = 0;
    let skipCount = 0;
    for (const row of auditRows.data ?? []) {
      const key = isoDay(new Date(row.created_at));
      if (row.action === "export.csv") {
        exportCount++;
        exportRecords += row.record_count ?? 0;
        const b = exportsDaily.get(key);
        if (b) {
          b.count++;
          b.records += row.record_count ?? 0;
        }
      } else if (row.action === "skiptrace.run") {
        skipCount++;
        if (skipDaily.has(key)) skipDaily.set(key, (skipDaily.get(key) ?? 0) + 1);
      }
    }

    return {
      owners: {
        total: ownersT,
        traced: ownersTr,
        pending: Math.max(0, ownersT - ownersTr),
        successRate,
      },
      contacts: {
        total: contactsTotal.count ?? 0,
        verified: contactsVerified.count ?? 0,
      },
      exports: {
        last30Days: exportCount,
        totalRecords: exportRecords,
        daily: Array.from(exportsDaily.entries()).map(([date, v]) => ({ date, ...v })),
      },
      skipTraces: {
        last30Days: skipCount,
        daily: Array.from(skipDaily.entries()).map(([date, count]) => ({ date, count })),
      },
    };
  });
