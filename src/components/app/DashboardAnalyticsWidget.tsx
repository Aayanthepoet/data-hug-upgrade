import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Download, TrendingUp, Users, Loader2, ArrowUpRight } from "lucide-react";
import { getDashboardAnalytics } from "@/lib/analytics/dashboard.functions";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function Sparkline({
  data,
  color,
  height = 48,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const max = Math.max(1, ...data);
  const w = 100;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`)
    .join(" ");
  const areaPoints = `0,${height} ${points} ${w},${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <polygon points={areaPoints} fill={color} opacity={0.15} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function DashboardAnalyticsWidget() {
  const fetchFn = useServerFn(getDashboardAnalytics);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  const exportSeries = useMemo(() => data?.exports.daily.map((d) => d.count) ?? [], [data]);
  const skipSeries = useMemo(() => data?.skipTraces.daily.map((d) => d.count) ?? [], [data]);

  if (isLoading) {
    return (
      <div className="surface p-6 flex items-center gap-3 text-[var(--w55)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="surface p-6 text-red-400 text-sm">
        Couldn’t load analytics: {(error as Error)?.message ?? "unknown error"}
      </div>
    );
  }

  return (
    <section className="surface p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <div className="eyebrow inline-flex">
            <span className="eyebrow-dot" />
            Last 30 days
          </div>
          <h2 className="text-xl font-bold mt-2">Activity overview</h2>
        </div>
        <TrendingUp className="h-5 w-5 text-cyan" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          to="/app/owners"
          search={{ status: "pending" }}
          className="group rounded-lg p-4 text-left hover:ring-1 hover:ring-cyan/40 transition"
          style={{ background: "var(--w05)" }}
          title="Open owners pending skip trace"
        >
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-[var(--w55)]">
            <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Owners</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
          </div>
          <div className="text-3xl font-bold mt-2">{data.owners.total.toLocaleString()}</div>
          <div className="text-xs text-[var(--w55)] mt-1 underline decoration-dotted underline-offset-2">
            {data.owners.pending.toLocaleString()} pending trace →
          </div>
        </Link>

        <Link
          to="/app/owners"
          search={{ status: "traced" }}
          className="group rounded-lg p-4 text-left hover:ring-1 hover:ring-emerald-400/40 transition"
          style={{ background: "var(--w05)" }}
          title="Open successfully traced owners"
        >
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-[var(--w55)]">
            <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Skip trace success</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
          </div>
          <div className="text-3xl font-bold mt-2 text-emerald-400">
            {pct(data.owners.successRate)}
          </div>
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--w10)" }}>
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.round(data.owners.successRate * 100)}%` }}
            />
          </div>
          <div className="text-xs text-[var(--w55)] mt-2 underline decoration-dotted underline-offset-2">
            {data.owners.traced.toLocaleString()} of {data.owners.total.toLocaleString()} traced →
          </div>
        </Link>

        <Link
          to="/app/audit"
          search={{ action: "export.csv" }}
          className="group rounded-lg p-4 text-left hover:ring-1 hover:ring-cyan/40 transition"
          style={{ background: "var(--w05)" }}
          title="View export events in the audit log"
        >
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-[var(--w55)]">
            <span className="flex items-center gap-2"><Download className="h-3.5 w-3.5" /> Exports (30d)</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
          </div>
          <div className="text-3xl font-bold mt-2 text-cyan">
            {data.exports.last30Days.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--w55)] mt-1 underline decoration-dotted underline-offset-2">
            {data.exports.totalRecords.toLocaleString()} records →
          </div>
          <div className="mt-2">
            <Sparkline data={exportSeries} color="#22d3ee" height={32} />
          </div>
        </Link>

        <Link
          to="/app/audit"
          search={{ action: "skiptrace.run" }}
          className="group rounded-lg p-4 text-left hover:ring-1 hover:ring-purple-400/40 transition"
          style={{ background: "var(--w05)" }}
          title="View skip trace events in the audit log"
        >
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-[var(--w55)]">
            <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Skip traces (30d)</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
          </div>
          <div className="text-3xl font-bold mt-2 text-purple-300">
            {data.skipTraces.last30Days.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--w55)] mt-1 underline decoration-dotted underline-offset-2">
            {data.contacts.verified.toLocaleString()} verified contacts →
          </div>
          <div className="mt-2">
            <Sparkline data={skipSeries} color="#a78bfa" height={32} />
          </div>
        </Link>
      </div>
    </section>
  );
}
