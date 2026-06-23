import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileSignature, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { getContractsHealth } from "@/lib/contracts/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/admin/contracts")({
  component: AdminContractsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3 text-sm">
        <div className="flex items-center gap-2 text-red-400">
          <ShieldAlert className="h-4 w-4" />
          <span>{error.message}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="p-6 text-sm text-[var(--w55)]">Not found.</div>
  ),
});

const STATUS_TONE: Record<string, string> = {
  draft: "text-slate-300 bg-slate-500/10 border-slate-500/30",
  sent: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  viewed: "text-indigo-300 bg-indigo-500/10 border-indigo-500/30",
  signed: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  declined: "text-red-300 bg-red-500/10 border-red-500/30",
  cancelled: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
  error: "text-amber-300 bg-amber-500/10 border-amber-500/30",
};

const STATUS_ORDER = ["draft", "sent", "viewed", "signed", "declined", "cancelled", "error"];

function AdminContractsPage() {
  const fn = useServerFn(getContractsHealth);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "contracts-health"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-[var(--w55)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading contract health…
      </div>
    );
  }

  const statuses = STATUS_ORDER.filter((s) => (data.byStatus[s] ?? 0) > 0).concat(
    Object.keys(data.byStatus).filter((s) => !STATUS_ORDER.includes(s)),
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-[var(--w55)]" />
            Contract signing health
          </h1>
          <p className="text-xs text-[var(--w55)] mt-1">
            Admin overview across all users. Auto-refreshes every 30s.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Refresh
        </Button>
      </header>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total contracts" value={data.total} />
        <Stat
          label="Errors"
          value={data.byStatus.error ?? 0}
          tone={data.byStatus.error ? "danger" : "muted"}
        />
        <Stat
          label="Stalled (sent >7d)"
          value={data.stalledSent}
          tone={data.stalledSent ? "warn" : "muted"}
        />
        <Stat
          label="Signed, archive missing"
          value={data.signedMissingArchive}
          tone={data.signedMissingArchive ? "warn" : "muted"}
        />
      </div>

      {/* Status breakdown */}
      <section className="surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--w55)] mb-4">
          Counts by status
        </h2>
        {statuses.length === 0 ? (
          <p className="text-xs text-[var(--w55)]">No contracts yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {statuses.map((s) => {
              const n = data.byStatus[s] ?? 0;
              const pct = data.total ? Math.round((n / data.total) * 100) : 0;
              return (
                <div
                  key={s}
                  className={
                    "rounded-md border p-3 " + (STATUS_TONE[s] ?? STATUS_TONE.draft)
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-wider">{s}</span>
                    <span className="text-xs opacity-70">{pct}%</span>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">{n}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Failures */}
      <section className="surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--w55)] mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Failed webhooks & errors
        </h2>
        {data.errors.length === 0 ? (
          <p className="text-xs text-[var(--w55)]">No errors recorded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {data.errors.map((c) => (
              <li key={c.id} className="p-3 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill status={String(c.status)} />
                    <span className="font-medium truncate">
                      {c.buyer_name} ← {c.seller_name}
                    </span>
                  </div>
                  <p className="text-xs text-amber-300 mt-1 break-words">
                    {c.error_message ?? "—"}
                  </p>
                  <p className="text-[11px] text-[var(--w55)] mt-1 tabular-nums">
                    user {String(c.user_id).slice(0, 8)}… ·{" "}
                    {new Date(String(c.updated_at)).toLocaleString()}
                    {c.signwell_document_id ? ` · doc ${String(c.signwell_document_id).slice(0, 8)}…` : ""}
                  </p>
                </div>
                <Link
                  to="/app/contracts/$contractId"
                  params={{ contractId: String(c.id) }}
                  className="text-xs text-blue-300 hover:underline shrink-0"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent activity */}
      <section className="surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--w55)] mb-3">
          Recent updates
        </h2>
        {data.recent.length === 0 ? (
          <p className="text-xs text-[var(--w55)]">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {data.recent.map((c) => (
              <li key={c.id} className="p-3 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill status={String(c.status)} />
                    <span className="font-medium truncate">
                      {c.buyer_name} ← {c.seller_name}
                    </span>
                    <span className="text-xs text-[var(--w55)]">
                      $
                      {Number(c.purchase_price).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--w55)] mt-1 tabular-nums">
                    user {String(c.user_id).slice(0, 8)}… ·{" "}
                    {new Date(String(c.updated_at)).toLocaleString()}
                    {c.signed_at ? ` · signed ${new Date(String(c.signed_at)).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Link
                  to="/app/contracts/$contractId"
                  params={{ contractId: String(c.id) }}
                  className="text-xs text-blue-300 hover:underline shrink-0"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "warn" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-border bg-muted/20 text-foreground";
  return (
    <div className={"rounded-md border p-4 " + toneCls}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--w55)]">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border " +
        (STATUS_TONE[status] ?? STATUS_TONE.draft)
      }
    >
      {status}
    </span>
  );
}
