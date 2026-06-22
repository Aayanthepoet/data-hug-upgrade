import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText, Download, Search, Send, FileText } from "lucide-react";
import { listAuditEvents } from "@/lib/audit/audit.functions";

export const Route = createFileRoute("/_authenticated/app/audit")({
  head: () => ({ meta: [{ title: "Audit Log — PropAI" }] }),
  component: AuditPage,
  errorComponent: ({ error }) => <div className="p-6 text-red-400">{error.message}</div>,
});

const ACTION_META: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  "export.csv": { label: "CSV Export", icon: Download, color: "text-cyan" },
  "skiptrace.run": { label: "Skip trace", icon: Search, color: "text-emerald-400" },
  "outreach.send": { label: "Outreach sent", icon: Send, color: "text-purple-400" },
};

function AuditPage() {
  const listFn = useServerFn(listAuditEvents);
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", filter],
    queryFn: () => listFn({ data: { action: filter === "all" ? null : filter, limit: 200 } }),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h-display text-[clamp(28px,4vw,44px)]">Audit log</h1>
        <p className="text-[var(--w55)] text-sm mt-1">
          Every export, skip trace, and outreach send — who, what, when, and how many records.
        </p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {[
          { k: "all", label: "All actions" },
          { k: "export.csv", label: "Exports" },
          { k: "skiptrace.run", label: "Skip traces" },
          { k: "outreach.send", label: "Outreach" },
        ].map((opt) => (
          <button
            key={opt.k}
            onClick={() => setFilter(opt.k)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              filter === opt.k ? "bg-cyan/15 text-cyan border-cyan/40" : "border-border text-[var(--w55)] hover:bg-white/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-[var(--w55)] text-sm">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="border border-border rounded-lg p-10 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-[var(--w55)]" />
          <p className="mt-3 text-sm text-[var(--w55)]">No audit events yet.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--w55)] text-xs uppercase tracking-widest">
              <tr>
                <th className="p-4">When</th>
                <th className="p-4">Action</th>
                <th className="p-4">Resource</th>
                <th className="p-4 text-right">Records</th>
                <th className="p-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = ACTION_META[r.action] ?? { label: r.action, icon: FileText, color: "text-white" };
                const Icon = meta.icon;
                const md = (r.metadata ?? {}) as Record<string, unknown>;
                const filename = typeof md.filename === "string" ? md.filename : null;
                const ownerNames = Array.isArray(md.owner_names) ? (md.owner_names as string[]) : [];
                const resourceCount = (r.resource_ids ?? []).length;
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-4 text-[var(--w55)] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        <span className="font-medium">{meta.label}</span>
                      </span>
                    </td>
                    <td className="p-4">
                      <div>{r.resource_type}</div>
                      {resourceCount > 0 && (
                        <div className="text-[10px] text-[var(--w55)] mt-0.5">{resourceCount} owner{resourceCount === 1 ? "" : "s"}</div>
                      )}
                    </td>
                    <td className="p-4 text-right tabular-nums">
                      <span className="text-cyan font-medium">{r.record_count}</span>
                    </td>
                    <td className="p-4 text-[var(--w55)] text-xs">
                      {filename && <div className="font-mono">{filename}</div>}
                      {ownerNames.length > 0 && (
                        <div className="truncate max-w-[420px]">
                          {ownerNames.slice(0, 3).join(", ")}
                          {ownerNames.length > 3 && ` +${ownerNames.length - 3} more`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
