import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOwners, listOwnerContacts, runSkipTrace } from "@/lib/skiptrace/skiptrace.functions";
import { Search, ChevronDown, ChevronRight, Phone, Mail, Users } from "lucide-react";
import { SkipTraceBadge } from "@/components/app/SkipTraceBadge";

export const Route = createFileRoute("/_authenticated/app/owners")({
  head: () => ({ meta: [{ title: "Owners — PropAI" }] }),
  component: OwnersPage,
  errorComponent: ({ error }) => <div className="p-6 text-red-400">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function OwnersPage() {
  const fetchOwners = useServerFn(listOwners);
  const { data: owners, isLoading } = useQuery({
    queryKey: ["owners"],
    queryFn: () => fetchOwners(),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h-display text-[clamp(28px,4vw,44px)]">Owners</h1>
        <p className="text-[var(--w55)] text-sm mt-1">
          People and entities behind your saved properties. Run skip trace to surface phones, emails, and relatives.
        </p>
      </header>

      {isLoading && <p className="text-[var(--w55)] text-sm">Loading…</p>}

      {!isLoading && (!owners || owners.length === 0) && (
        <div className="border border-border rounded-lg p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-[var(--w55)]" />
          <p className="mt-3 text-sm text-[var(--w55)]">No owners yet. Save a property to seed this list.</p>
        </div>
      )}

      {owners && owners.length > 0 && (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--w55)] text-xs uppercase tracking-widest">
              <tr>
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
              {owners.map((o) => (
                <OwnerRow key={o.id} owner={o} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type OwnerRowProps = {
  owner: {
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
};

function OwnerRow({ owner }: OwnerRowProps) {
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

  return (
    <>
      <tr className="border-t border-border hover:bg-[rgba(255,255,255,.02)]">
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
          <SkipTraceBadge status={owner.skip_trace_status} lastRunAt={owner.skip_trace_last_run_at} />
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
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5 text-cyan" />
            {mut.isPending ? "Tracing…" : owner.skip_trace_status === "traced" ? "Re-trace" : "Skip trace"}
          </button>
          {mut.error && <p className="text-red-400 text-[10px] mt-1">{(mut.error as Error).message}</p>}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-[rgba(255,255,255,.02)]">
          <td colSpan={7} className="p-4">
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

function ContactIcon({ type }: { type: string }) {
  if (type === "phone") return <Phone className="h-3.5 w-3.5 text-emerald-400" />;
  if (type === "email") return <Mail className="h-3.5 w-3.5 text-cyan" />;
  return <Users className="h-3.5 w-3.5 text-amber-400" />;
}
