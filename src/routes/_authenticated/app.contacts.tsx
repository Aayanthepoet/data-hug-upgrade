import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { resolveOwnerContacts } from "@/lib/engines/contacts.functions";
import { runSkipTrace, setContactDoNotContact } from "@/lib/skiptrace/skiptrace.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkipTraceBadge } from "@/components/app/SkipTraceBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/contacts")({
  head: () => ({ meta: [{ title: "Contacts — PropAI Contact Resolver" }] }),
  component: ContactsPage,
});

type PendingKind = "ai" | "skip" | "both";

function ContactsPage() {
  const resolve = useServerFn(resolveOwnerContacts);
  const skipTrace = useServerFn(runSkipTrace);
  const [pending, setPending] = useState<{ id: string; kind: PendingKind } | null>(null);

  const { data: owners, refetch } = useQuery({
    queryKey: ["owners-with-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owners")
        .select("id, full_name, entity_type, mailing_address, property_id, skip_trace_status, skip_trace_last_run_at, contacts(id, contact_type, value, confidence, notes, do_not_contact)")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function runAi(ownerId: string) {
    setPending({ id: ownerId, kind: "ai" });
    try {
      const res = await resolve({ data: { owner_id: ownerId } });
      toast.success(`AI resolver: ${res.resolved} candidate(s)`);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(null);
    }
  }

  async function runSkip(ownerId: string) {
    setPending({ id: ownerId, kind: "skip" });
    try {
      const res = await skipTrace({ data: { owner_id: ownerId } });
      toast.success(`Skip trace (${res.provider}): ${res.inserted} contact(s) · ${res.status}`);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(null);
    }
  }

  async function runBoth(ownerId: string) {
    setPending({ id: ownerId, kind: "both" });
    try {
      const [skipRes, aiRes] = await Promise.all([
        skipTrace({ data: { owner_id: ownerId } }),
        resolve({ data: { owner_id: ownerId } }),
      ]);
      toast.success(`Resolved ${skipRes.inserted} skip-trace + ${aiRes.resolved} AI candidate(s)`);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Contact Resolver · skip-trace</div>
        <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">Skip-traced <span className="h-italic">contacts</span></h1>
        <p className="text-[var(--w55)] mt-3 max-w-xl">Resolve phones, emails, and socials from your owner records. Skip-trace provider returns verified-style hits; the AI resolver adds inferred candidates. All scores are pending verification.</p>
      </div>

      <div className="space-y-3">
        {(owners ?? []).length === 0 && (
          <div className="surface p-6 text-sm text-[var(--w55)]">No owners yet. Add owners from the Properties page.</div>
        )}
        {(owners ?? []).map((o) => {
          const isPending = pending?.id === o.id;
          return (
            <div key={o.id} className="surface p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="font-semibold flex items-center gap-2">
                    {o.full_name ?? "Unknown owner"}
                    <SkipTraceBadge status={o.skip_trace_status} lastRunAt={o.skip_trace_last_run_at} />
                  </div>
                  <div className="text-xs text-[var(--w55)]">{o.entity_type ?? "individual"} · {o.mailing_address ?? ""}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => runSkip(o.id)}>
                    {isPending && pending?.kind === "skip" ? "Tracing…" : "Skip trace"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => runAi(o.id)}>
                    {isPending && pending?.kind === "ai" ? "Resolving…" : "AI resolve"}
                  </Button>
                  <Button size="sm" disabled={isPending} onClick={() => runBoth(o.id)}>
                    {isPending && pending?.kind === "both" ? "Running…" : "Run both"}
                  </Button>
                </div>
              </div>
              {o.contacts && o.contacts.length > 0 && (
                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  {o.contacts.map((c) => {
                    const isSkip = typeof c.notes === "string" && c.notes.startsWith("Skip trace");
                    return (
                      <div key={c.id} className="text-xs flex items-center gap-2 border border-border rounded p-2">
                        <Badge variant="outline">{c.contact_type}</Badge>
                        <span className="font-mono truncate">{c.value}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">{isSkip ? "skip-trace" : "AI"}</Badge>
                          <span className="text-[var(--w55)]">{c.confidence ?? 0}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
