import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ShieldOff, TrendingUp, TrendingDown, FileDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { exportTrendsCsv, exportTrendsPdf } from "@/lib/export-opt-outs";

type Row = { opted_out_at: string; keyword: string | null; restored_at: string | null };

const KEYWORDS = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "STOPALL"] as const;
const KEYWORD_COLORS: Record<string, string> = {
  STOP: "var(--red)",
  UNSUBSCRIBE: "var(--gold)",
  CANCEL: "var(--violet)",
  END: "var(--cyan)",
  QUIT: "var(--green)",
  STOPALL: "var(--red)",
  OTHER: "var(--w45)",
};

const DAYS = 30;

export function OptOutTrendsWidget() {
  const { user } = useAuth();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      return !!data;
    },
  });

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - DAYS);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["opt-out-trends", since],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_opt_outs")
        .select("opted_out_at, keyword, restored_at")
        .gte("opted_out_at", since)
        .order("opted_out_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { series, byKeyword, total, activeTotal, deltaPct } = useMemo(() => {
    const buckets = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }

    const kwCounts: Record<string, number> = {};
    let active = 0;
    for (const r of rows) {
      const day = r.opted_out_at.slice(0, 10);
      if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
      const raw = (r.keyword ?? "OTHER").toUpperCase();
      const kw = (KEYWORDS as readonly string[]).includes(raw) ? raw : "OTHER";
      kwCounts[kw] = (kwCounts[kw] ?? 0) + 1;
      if (!r.restored_at) active++;
    }

    const seriesArr = Array.from(buckets.entries()).map(([day, count]) => ({
      day,
      label: new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
    }));

    // Compare last 7d vs previous 7d
    const last7 = seriesArr.slice(-7).reduce((s, x) => s + x.count, 0);
    const prev7 = seriesArr.slice(-14, -7).reduce((s, x) => s + x.count, 0);
    const delta = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round(((last7 - prev7) / prev7) * 100);

    const sortedKw = Object.entries(kwCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, count]) => ({ keyword, count }));

    return {
      series: seriesArr,
      byKeyword: sortedKw,
      total: rows.length,
      activeTotal: active,
      deltaPct: delta,
    };
  }, [rows]);

  if (!isAdmin) return null;

  const trendingUp = deltaPct > 0;
  const maxKw = byKeyword[0]?.count ?? 0;

  return (
    <div className="surface p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[var(--w55)]">
            <ShieldOff className="h-3.5 w-3.5" />
            Compliance · Opt-outs
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-3xl font-bold">{total}</div>
            <div className="text-sm text-[var(--w55)]">in last {DAYS} days</div>
            <div
              className={`text-xs flex items-center gap-1 ${
                trendingUp ? "text-red-400" : "text-emerald-400"
              }`}
              title="Last 7 days vs previous 7 days"
            >
              {trendingUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {deltaPct > 0 ? "+" : ""}
              {deltaPct}% wk/wk
            </div>
          </div>
          <div className="text-xs text-[var(--w45)] mt-1">
            {activeTotal} currently suppressed · {total - activeTotal} restored
          </div>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <button
            onClick={() => exportTrendsCsv(series, byKeyword)}
            disabled={total === 0}
            className="text-xs text-[var(--w55)] hover:text-foreground disabled:opacity-40 flex items-center gap-1 px-2 py-1 rounded border border-border"
            title="Export trends as CSV"
          >
            <FileDown className="h-3 w-3" /> CSV
          </button>
          <button
            onClick={() =>
              exportTrendsPdf(series, byKeyword, {
                totalDays: DAYS,
                total,
                active: activeTotal,
                deltaPct,
              })
            }
            disabled={total === 0}
            className="text-xs text-[var(--w55)] hover:text-foreground disabled:opacity-40 flex items-center gap-1 px-2 py-1 rounded border border-border"
            title="Export trends as PDF"
          >
            <FileText className="h-3 w-3" /> PDF
          </button>
          <Link
            to="/app/opt-outs"
            className="text-xs text-cyan hover:underline"
          >
            Manage →
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
        {/* Trend chart */}
        <div className="h-[200px]">
          {isLoading ? (
            <div className="h-full grid place-items-center text-sm text-[var(--w45)]">Loading…</div>
          ) : total === 0 ? (
            <div className="h-full grid place-items-center text-sm text-[var(--w45)]">
              No opt-outs recorded in the last {DAYS} days. ✓
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--w45)"
                  fontSize={11}
                  interval={Math.floor(DAYS / 6)}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--w45)"
                  fontSize={11}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--s1)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--w55)" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--cyan)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Keyword breakdown */}
        <div>
          <div className="text-xs uppercase tracking-widest font-bold text-[var(--w45)] mb-3">
            By keyword
          </div>
          {byKeyword.length === 0 ? (
            <div className="text-sm text-[var(--w45)]">No data.</div>
          ) : (
            <div className="space-y-2.5">
              {byKeyword.map(({ keyword, count }) => {
                const pct = maxKw === 0 ? 0 : (count / maxKw) * 100;
                const color = KEYWORD_COLORS[keyword] ?? KEYWORD_COLORS.OTHER;
                return (
                  <div key={keyword}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono text-[var(--w65)]">{keyword}</span>
                      <span className="text-[var(--w55)]">{count}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--s1)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
