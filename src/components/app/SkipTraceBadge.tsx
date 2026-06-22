import { CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";

export type SkipTraceStatus = "pending" | "traced" | "no_hit" | "failed";

const META: Record<SkipTraceStatus, { label: string; icon: typeof Clock; cls: string; dot: string }> = {
  pending: { label: "Pending",   icon: Clock,        cls: "text-amber-300 border-amber-400/30 bg-amber-400/10", dot: "bg-amber-400" },
  traced:  { label: "Verified",  icon: CheckCircle2, cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", dot: "bg-emerald-400" },
  no_hit:  { label: "No hits",   icon: XCircle,      cls: "text-slate-300 border-slate-400/30 bg-slate-400/10", dot: "bg-slate-400" },
  failed:  { label: "Failed",    icon: AlertCircle,  cls: "text-red-300 border-red-400/30 bg-red-400/10", dot: "bg-red-400" },
};

export function SkipTraceBadge({
  status,
  lastRunAt,
  size = "sm",
}: {
  status: SkipTraceStatus | string | null | undefined;
  lastRunAt?: string | null;
  size?: "xs" | "sm";
}) {
  const key = (status ?? "pending") as SkipTraceStatus;
  const m = META[key] ?? META.pending;
  const Icon = m.icon;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  const title = lastRunAt ? `Last skip trace: ${new Date(lastRunAt).toLocaleString()}` : "Not skip traced yet";
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border font-medium ${pad} ${m.cls}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

export function SkipTraceDot({ status }: { status: SkipTraceStatus | string | null | undefined }) {
  const m = META[(status ?? "pending") as SkipTraceStatus] ?? META.pending;
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />;
}
