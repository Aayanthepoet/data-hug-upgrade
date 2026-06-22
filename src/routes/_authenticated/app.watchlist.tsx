import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listWatchlist,
  getWatchlistStats,
  getAlertTrend,
  updateWatchlistItem,
  deleteWatchlistItem,
  type WatchlistItem,
} from "@/lib/watchlist.functions";
import { Eye, Trash2, AlertTriangle, Gavel, FileSignature, ArrowRight, Bell, BellRing, Bookmark } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/app/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist — PropAI" }] }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const fetchList = useServerFn(listWatchlist);
  const fetchStats = useServerFn(getWatchlistStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetchList(),
  });
  const { data: stats } = useQuery({
    queryKey: ["watchlist-stats"],
    queryFn: () => fetchStats(),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Eye className="h-6 w-6 text-cyan" /> Watchlist
        </h1>
        <p className="text-sm text-[var(--w55)]">
          Save properties and choose which distress signals should trigger an alert.
          Open any property and use <span className="text-white">“Save to watchlist”</span> to add it here.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Properties watched"
          value={stats?.watching ?? "—"}
          icon={<Bookmark className="h-4 w-4 text-cyan" />}
        />
        <StatCard
          label="New alerts today"
          value={stats?.alertsToday ?? "—"}
          icon={<BellRing className="h-4 w-4 text-amber-400" />}
          accent={stats && stats.alertsToday > 0 ? "amber" : undefined}
        />
        <StatCard
          label="Alerts this week"
          value={stats?.alertsThisWeek ?? "—"}
          icon={<Bell className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="By type (week)"
          value={
            stats
              ? `${stats.alertsByType.foreclosure} · ${stats.alertsByType.lis_pendens} · ${stats.alertsByType.deed_transfer}`
              : "—"
          }
          hint="Foreclosure · Lis pendens · Deed"
        />
      </section>

      <AlertTrendChart />



      {isLoading && <div className="text-[var(--w55)] text-sm">Loading…</div>}
      {error && <div className="text-red-400 text-sm">{(error as Error).message}</div>}

      {!isLoading && data && data.length === 0 && (
        <div className="border border-border rounded-lg p-8 text-center text-sm text-[var(--w55)]">
          No saved properties yet.{" "}
          <Link to="/app/properties/search" className="text-cyan">
            Find distressed properties →
          </Link>
        </div>
      )}

      <div className="grid gap-3">
        {data?.map((item) => <WatchRow key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function WatchRow({ item }: { item: WatchlistItem }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateWatchlistItem);
  const deleteFn = useServerFn(deleteWatchlistItem);
  const [local, setLocal] = useState(item);

  const mutate = useMutation({
    mutationFn: (patch: Partial<WatchlistItem>) =>
      updateFn({ data: { id: item.id, ...patch } as never }),
    onSuccess: (row) => {
      setLocal(row);
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const removeMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: item.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const toggle = (key: "alert_foreclosure" | "alert_lis_pendens" | "alert_deed_transfer") => {
    const next = !local[key];
    setLocal({ ...local, [key]: next });
    mutate.mutate({ [key]: next });
  };

  return (
    <div className="border border-border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{local.address}</div>
        <div className="text-xs text-[var(--w55)] truncate">
          {[local.city, local.state, local.county].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <AlertChip
          active={local.alert_foreclosure}
          onClick={() => toggle("alert_foreclosure")}
          icon={<AlertTriangle className="h-3 w-3" />}
          label="Foreclosure"
          color="rgb(239,68,68)"
        />
        <AlertChip
          active={local.alert_lis_pendens}
          onClick={() => toggle("alert_lis_pendens")}
          icon={<Gavel className="h-3 w-3" />}
          label="Lis pendens"
          color="rgb(249,115,22)"
        />
        <AlertChip
          active={local.alert_deed_transfer}
          onClick={() => toggle("alert_deed_transfer")}
          icon={<FileSignature className="h-3 w-3" />}
          label="Deed transfer"
          color="rgb(6,182,212)"
        />
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/app/properties/$propertyId"
          params={{ propertyId: local.property_key }}
          className="text-xs text-cyan inline-flex items-center gap-1 hover:underline"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          title="Remove from watchlist"
          onClick={() => {
            if (confirm("Remove this property from watchlist?")) removeMut.mutate();
          }}
          className="text-[var(--w55)] hover:text-red-400 p-1"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AlertChip({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border transition"
      style={{
        borderColor: active ? color : "rgba(255,255,255,0.12)",
        background: active ? `${color}1f` : "transparent",
        color: active ? color : "var(--w55)",
      }}
      title={active ? `Alerts ON for ${label}` : `Alerts OFF for ${label}`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  accent?: "amber";
}) {
  return (
    <div
      className="border rounded-lg p-3"
      style={{
        borderColor: accent === "amber" ? "rgba(251,191,36,0.4)" : "var(--border, rgba(255,255,255,0.1))",
        background: accent === "amber" ? "rgba(251,191,36,0.06)" : "transparent",
      }}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--w55)]">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[10px] text-[var(--w55)] mt-0.5">{hint}</div>}
    </div>
  );
}
