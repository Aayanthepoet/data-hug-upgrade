import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { resolveOwnerContacts } from "@/lib/engines/contacts.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/contacts")({
  head: () => ({ meta: [{ title: "Contacts — PropAI Contact Resolver" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  const resolve = useServerFn(resolveOwnerContacts);
  const [pending, setPending] = useState<string | null>(null);

  const { data: owners, refetch } = useQuery({
    queryKey: ["owners-with-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owners")
        .select("id, full_name, entity_type, mailing_address, property_id, contacts(id, contact_type, value, confidence, notes)")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function run(ownerId: string) {
    setPending(ownerId);
    try {
      const res = await resolve({ data: { owner_id: ownerId } });
      toast.success(`Resolved ${res.resolved} contact candidate(s)`);
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
        <p className="text-[var(--w55)] mt-3 max-w-xl">Resolve phones, emails, and socials from your owner records. AI-generated candidates with confidence scores — verify before contacting.</p>
      </div>

      <div className="space-y-3">
        {(owners ?? []).length === 0 && (
          <div className="surface p-6 text-sm text-[var(--w55)]">No owners yet. Add owners from the Properties page.</div>
        )}
        {(owners ?? []).map((o) => (
          <div key={o.id} className="surface p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold">{o.full_name ?? "Unknown owner"}</div>
                <div className="text-xs text-[var(--w55)]">{o.entity_type ?? "individual"} · {o.mailing_address ?? ""}</div>
              </div>
              <Button size="sm" disabled={pending === o.id} onClick={() => run(o.id)}>
                {pending === o.id ? "Resolving…" : "Resolve contacts"}
              </Button>
            </div>
            {o.contacts && o.contacts.length > 0 && (
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {o.contacts.map((c) => (
                  <div key={c.id} className="text-xs flex items-center gap-2 border border-border rounded p-2">
                    <Badge variant="outline">{c.contact_type}</Badge>
                    <span className="font-mono">{c.value}</span>
                    <span className="ml-auto text-[var(--w55)]">{c.confidence ?? 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
