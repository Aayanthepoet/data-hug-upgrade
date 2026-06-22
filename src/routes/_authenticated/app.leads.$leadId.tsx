import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/leads/$leadId")({
  head: () => ({ meta: [{ title: "Lead — PropAI" }] }),
  component: LeadDetailPage,
});

type Lead = {
  id: string;
  full_name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  created_at: string;
};

type LeadNote = {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const leadQuery = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads").select("*").eq("id", leadId).maybeSingle();
      if (error) throw error;
      return data as Lead | null;
    },
  });

  const notesQuery = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes").select("*").eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadNote[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [body, setBody] = useState("");
  const addNote = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error("Note can't be empty");
      const { error } = await supabase.from("lead_notes").insert({
        lead_id: leadId,
        author_id: user?.id,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      toast.success("Note added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-notes", leadId] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (leadQuery.isLoading) {
    return <div className="text-sm text-[var(--w55)]">Loading…</div>;
  }
  if (leadQuery.error) {
    return <div className="text-sm text-red-400">Couldn't load lead.</div>;
  }
  const lead = leadQuery.data;
  if (!lead) {
    return (
      <div className="space-y-4">
        <Link to="/app/leads" className="text-sm text-cyan hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
        <p className="text-sm text-[var(--w55)]">Lead not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link to="/app/leads" className="text-sm text-cyan hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
        <h1 className="text-3xl font-bold mt-3">{lead.full_name || "Unnamed lead"}</h1>
        <p className="text-sm text-[var(--w55)] mt-1">
          Submitted {new Date(lead.created_at).toLocaleString()}
          {lead.source ? ` · via ${lead.source}` : ""}
        </p>
      </div>

      <section className="border border-border rounded-lg p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="Email" value={lead.email ? <a href={`mailto:${lead.email}`} className="text-cyan hover:underline">{lead.email}</a> : "—"} />
          <Field label="Phone" value={lead.phone ? <a href={`tel:${lead.phone}`} className="text-cyan hover:underline">{lead.phone}</a> : "—"} />
          <Field label="Company" value={lead.company || "—"} />
          <Field label="Source" value={lead.source || "—"} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--w55)] mb-1">Message</div>
          <div className="text-sm whitespace-pre-wrap rounded-md bg-[rgba(255,255,255,.03)] p-3 border border-border">
            {lead.message || <span className="text-[var(--w55)]">No message provided.</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="text-xs uppercase tracking-wider text-[var(--w55)]">Status</div>
          <Select
            value={lead.status || "new"}
            onValueChange={(v) => updateStatus.mutate(v)}
          >
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{lead.status || "new"}</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Follow-up notes</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); addNote.mutate(); }}
          className="space-y-2"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note about this lead…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={addNote.isPending || !body.trim()}>
              {addNote.isPending ? "Saving…" : "Add note"}
            </Button>
          </div>
        </form>

        {notesQuery.isLoading ? (
          <p className="text-sm text-[var(--w55)]">Loading notes…</p>
        ) : (notesQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--w55)]">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notesQuery.data!.map((n) => (
              <li key={n.id} className="border border-border rounded-md p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-[var(--w55)]">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                  <button
                    onClick={() => deleteNote.mutate(n.id)}
                    className="text-[var(--w55)] hover:text-red-400"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 text-sm whitespace-pre-wrap">{n.body}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[var(--w55)]">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}
