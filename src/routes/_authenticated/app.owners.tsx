import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOwners, listOwnerContacts, runSkipTrace } from "@/lib/skiptrace/skiptrace.functions";
import { Search, ChevronDown, ChevronRight, Phone, Mail, Users, Loader2, CheckCircle2, AlertCircle, X, Download } from "lucide-react";
import { SkipTraceBadge } from "@/components/app/SkipTraceBadge";

export const Route = createFileRoute("/_authenticated/app/owners")({
  head: () => ({ meta: [{ title: "Owners — PropAI" }] }),
  component: OwnersPage,
  errorComponent: ({ error }) => <div className="p-6 text-red-400">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

type Owner = {
  id: string;
  full_name: string;
  entity_type: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  contact_count: number;
  skip_trace_status?: string | null;
  skip_trace_last_run_at?: string | null;
  properties: { address: string } | { address: string }[] | null;
};

type BulkProgress = {
  status: "queued" | "running" | "done" | "error";
  inserted?: number;
  outcome?: string; // 'traced' | 'no_hit'
  message?: string;
};

const BULK_CONCURRENCY = 3;

function OwnersPage() {
  const fetchOwners = useServerFn(listOwners);
  const qc = useQueryClient();
  const traceFn = useServerFn(runSkipTrace);
  const fetchContacts = useServerFn(listOwnerContacts);

  const { data: owners, isLoading } = useQuery({
    queryKey: ["owners"],
    queryFn: () => fetchOwners(),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, BulkProgress>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const ownerList = owners ?? [];
  const allSelected = ownerList.length > 0 && ownerList.every((o) => selected.has(o.id));
  const someSelected = selected.size > 0 && !allSelected;

  const pendingIds = useMemo(
    () => ownerList.filter((o) => (o.skip_trace_status ?? "pending") !== "traced").map((o) => o.id),
    [ownerList],
  );

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => (prev.size === ownerList.length ? new Set() : new Set(ownerList.map((o) => o.id))));

  async function runBulk(ids: string[]) {
    if (bulkRunning || ids.length === 0) return;
    setBulkRunning(true);
    const init: Record<string, BulkProgress> = {};
    for (const id of ids) init[id] = { status: "queued" };
    setProgress((p) => ({ ...p, ...init }));

    const queue = [...ids];
    const workers = Array.from({ length: Math.min(BULK_CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift()!;
        setProgress((p) => ({ ...p, [id]: { status: "running" } }));
        try {
          const res = (await traceFn({ data: { owner_id: id } })) as {
            inserted: number; status: string;
          };
          setProgress((p) => ({
            ...p,
            [id]: { status: "done", inserted: res.inserted, outcome: res.status },
          }));
          qc.invalidateQueries({ queryKey: ["owner-contacts", id] });
        } catch (e) {
          setProgress((p) => ({ ...p, [id]: { status: "error", message: (e as Error).message } }));
        }
      }
    });
    await Promise.all(workers);
    qc.invalidateQueries({ queryKey: ["owners"] });
    setBulkRunning(false);
  }

  async function exportContacts(ids: string[]) {
    if (exporting || ids.length === 0) return;
    setExporting(true);
    try {
      const ownerById = new Map(ownerList.map((o) => [o.id, o]));
      const results = await Promise.all(
        ids.map(async (id) => ({
          id,
          rows: await fetchContacts({ data: { owner_id: id } }),
        })),
      );

      const csvRows: string[][] = [[
        "owner_id", "owner_name", "entity_type",
        "contact_type", "value", "confidence", "is_verified",
        "skip_trace_status", "skip_trace_last_run_at", "notes",
      ]];
      let count = 0;
      for (const { id, rows } of results) {
        const o = ownerById.get(id);
        if (!o) continue;
        for (const c of rows) {
          if (c.contact_type !== "phone" && c.contact_type !== "email") continue;
          if (c.do_not_contact) continue;
          csvRows.push([
            o.id,
            o.full_name,
            o.entity_type ?? "",
            c.contact_type,
            c.value,
            c.confidence != null ? String(c.confidence) : "",
            c.is_verified ? "true" : "false",
            o.skip_trace_status ?? "pending",
            o.skip_trace_last_run_at ?? "",
            c.notes ?? "",
          ]);
          count++;
        }
      }

      if (count === 0) {
        alert("No verified phone/email contacts to export for the selected owners.");
        return;
      }

      const csv = csvRows
        .map((row) => row.map((v) => {
          const s = String(v ?? "");
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(","))
        .join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `owner-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const bulkStats = useMemo(() => {
    const entries = Object.values(progress);
    return {
      total: entries.length,
      done: entries.filter((e) => e.status === "done").length,
      running: entries.filter((e) => e.status === "running").length,
      queued: entries.filter((e) => e.status === "queued").length,
      errors: entries.filter((e) => e.status === "error").length,
    };
  }, [progress]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h-display text-[clamp(28px,4vw,44px)]">Owners</h1>
          <p className="text-[var(--w55)] text-sm mt-1">
            People and entities behind your saved properties. Run skip trace to surface phones, emails, and relatives.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runBulk(pendingIds)}
            disabled={bulkRunning || pendingIds.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5 text-cyan" />
            Trace all pending ({pendingIds.length})
          </button>
          <button
            onClick={() => runBulk(Array.from(selected))}
            disabled={bulkRunning || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-cyan text-black px-3 py-2 text-xs font-medium hover:bg-cyan/90 disabled:opacity-50 disabled:bg-cyan/40"
          >
            {bulkRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Skip trace selected ({selected.size})
          </button>
        </div>
      </header>

      {bulkStats.total > 0 && (
        <BulkProgressBar
          stats={bulkStats}
          running={bulkRunning}
          onClear={() => setProgress({})}
        />
      )}

      {isLoading && <p className="text-[var(--w55)] text-sm">Loading…</p>}

      {!isLoading && ownerList.length === 0 && (
        <div className="border border-border rounded-lg p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-[var(--w55)]" />
          <p className="mt-3 text-sm text-[var(--w55)]">No owners yet. Save a property to seed this list.</p>
        </div>
      )}

      {ownerList.length > 0 && (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--w55)] text-xs uppercase tracking-widest">
              <tr>
                <th className="p-4 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    aria-label="Select all owners"
                    className="accent-cyan"
                  />
                </th>
                <th className="p-4 w-8"></th>
                <th className="p-4">Owner</th>
                <th className="p-4">Skip trace</th>
                <th className="p-4">Property</th>
                <th className="p-4">Mailing</th>
                <th className="p-4">Contacts</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ownerList.map((o) => (
                <OwnerRow
                  key={o.id}
                  owner={o}
                  selected={selected.has(o.id)}
                  onToggle={() => toggleOne(o.id)}
                  bulk={progress[o.id]}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BulkProgressBar({
  stats,
  running,
  onClear,
}: {
  stats: { total: number; done: number; running: number; queued: number; errors: number };
  running: boolean;
  onClear: () => void;
}) {
  const completed = stats.done + stats.errors;
  const pct = stats.total === 0 ? 0 : Math.round((completed / stats.total) * 100);
  return (
    <div className="surface p-4 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin text-cyan" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          <span className="font-medium">
            {running ? "Skip tracing in progress" : "Skip trace complete"}
          </span>
          <span className="text-[var(--w55)] text-xs">
            {completed} / {stats.total} owners
            {stats.errors > 0 && <span className="text-red-400"> · {stats.errors} failed</span>}
          </span>
        </div>
        {!running && (
          <button onClick={onClear} className="text-[var(--w55)] hover:text-white text-xs inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-cyan transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function OwnerRow({
  owner,
  selected,
  onToggle,
  bulk,
}: {
  owner: Owner;
  selected: boolean;
  onToggle: () => void;
  bulk: BulkProgress | undefined;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const traceFn = useServerFn(runSkipTrace);
  const fetchContacts = useServerFn(listOwnerContacts);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["owner-contacts", owner.id],
    queryFn: () => fetchContacts({ data: { owner_id: owner.id } }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () => traceFn({ data: { owner_id: owner.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-contacts", owner.id] });
      qc.invalidateQueries({ queryKey: ["owners"] });
      setOpen(true);
    },
  });

  const prop = Array.isArray(owner.properties) ? owner.properties[0] : owner.properties;
  const isBulkBusy = bulk?.status === "queued" || bulk?.status === "running";

  return (
    <>
      <tr className="border-t border-border hover:bg-[rgba(255,255,255,.02)]">
        <td className="p-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${owner.full_name}`}
            className="accent-cyan"
          />
        </td>
        <td className="p-4">
          <button onClick={() => setOpen((v) => !v)} className="text-[var(--w55)] hover:text-white">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="p-4">
          <div className="font-medium">{owner.full_name}</div>
          {owner.entity_type && <div className="text-[10px] uppercase tracking-wider text-[var(--w55)] mt-0.5">{owner.entity_type}</div>}
        </td>
        <td className="p-4">
          <div className="flex flex-col gap-1">
            <SkipTraceBadge status={owner.skip_trace_status} lastRunAt={owner.skip_trace_last_run_at} />
            {bulk && <BulkRowIndicator bulk={bulk} />}
          </div>
        </td>
        <td className="p-4 text-[var(--w55)]">{prop?.address ?? "—"}</td>
        <td className="p-4 text-[var(--w55)]">
          {[owner.mailing_city, owner.mailing_state, owner.mailing_zip].filter(Boolean).join(", ") || "—"}
        </td>
        <td className="p-4">
          <span className="text-cyan">{owner.contact_count}</span>
        </td>
        <td className="p-4 text-right">
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || isBulkBusy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5 text-cyan" />
            {mut.isPending || isBulkBusy ? "Tracing…" : owner.skip_trace_status === "traced" ? "Re-trace" : "Skip trace"}
          </button>
          {mut.error && <p className="text-red-400 text-[10px] mt-1">{(mut.error as Error).message}</p>}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-[rgba(255,255,255,.02)]">
          <td colSpan={8} className="p-4">
            {isLoading && <p className="text-[var(--w55)] text-xs">Loading contacts…</p>}
            {!isLoading && contacts && contacts.length === 0 && (
              <p className="text-[var(--w55)] text-xs">No contacts yet. Run skip trace to populate.</p>
            )}
            {contacts && contacts.length > 0 && (
              <ul className="space-y-1.5">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 text-xs">
                    <ContactIcon type={c.contact_type} />
                    <span className="font-mono">{c.value}</span>
                    {typeof c.confidence === "number" && (
                      <span className="text-[var(--w55)]">conf {c.confidence}</span>
                    )}
                    {c.notes && <span className="text-[var(--w55)] truncate">{c.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function BulkRowIndicator({ bulk }: { bulk: BulkProgress }) {
  if (bulk.status === "queued") {
    return <span className="text-[10px] text-[var(--w55)] inline-flex items-center gap-1">• Queued</span>;
  }
  if (bulk.status === "running") {
    return (
      <span className="text-[10px] text-cyan inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Tracing…
      </span>
    );
  }
  if (bulk.status === "error") {
    return (
      <span className="text-[10px] text-red-400 inline-flex items-center gap-1" title={bulk.message}>
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  // done
  const label =
    bulk.outcome === "no_hit"
      ? "No hits"
      : `+${bulk.inserted ?? 0} contact${(bulk.inserted ?? 0) === 1 ? "" : "s"}`;
  return (
    <span className="text-[10px] text-emerald-400 inline-flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" /> {label}
    </span>
  );
}

function ContactIcon({ type }: { type: string }) {
  if (type === "phone") return <Phone className="h-3.5 w-3.5 text-emerald-400" />;
  if (type === "email") return <Mail className="h-3.5 w-3.5 text-cyan" />;
  return <Users className="h-3.5 w-3.5 text-amber-400" />;
}
