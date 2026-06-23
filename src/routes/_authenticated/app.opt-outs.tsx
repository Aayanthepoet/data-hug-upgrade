import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, Search, Plus, RotateCcw, Trash2, Ban, FileDown, FileText, Send } from "lucide-react";
import { exportOptOutsCsv, exportOptOutsPdf } from "@/lib/export-opt-outs";
import { sendTestComplianceDigest } from "@/lib/compliance/digest.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type OptOut = {
  id: string;
  phone: string;
  keyword: string | null;
  reason: string | null;
  source: string;
  notes: string | null;
  opted_out_at: string;
  restored_at: string | null;
  restored_by: string | null;
  created_at: string;
};

type Filter = "active" | "restored" | "all";

export const Route = createFileRoute("/_authenticated/app/opt-outs")({
  component: OptOutsPage,
});

function OptOutsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [testDigestOpen, setTestDigestOpen] = useState(false);

  // Pull the admin's verified email from their profile so we can show it
  // before sending a test digest (server enforces sending to this address).
  const { data: myEmail } = useQuery({
    queryKey: ["my-profile-email", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.email ?? user?.email ?? null;
    },
  });

  const sendTestDigestFn = useServerFn(sendTestComplianceDigest);
  const sendTestDigest = useMutation({
    mutationFn: () =>
      sendTestDigestFn({
        data: {
          dashboardUrl:
            typeof window !== "undefined" ? `${window.location.origin}/app/opt-outs` : undefined,
        },
      }),
    onSuccess: (r) => {
      setTestDigestOpen(false);
      if (r.queued > 0) toast.success(`Test digest queued to ${r.recipientEmail}`);
      else if (r.suppressed > 0) toast.error(`${r.recipientEmail} is on the suppression list`);
      else toast.error("Digest could not be sent");
    },
    onError: (e) => toast.error((e as Error).message || "Failed to send test digest"),
  });

  // Verify admin
  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sms-opt-outs", filter, search],
    enabled: !!isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("sms_opt_outs")
        .select("*")
        .order("opted_out_at", { ascending: false })
        .limit(500);
      if (filter === "active") q = q.is("restored_at", null);
      if (filter === "restored") q = q.not("restored_at", "is", null);
      if (search.trim()) q = q.ilike("phone", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OptOut[];
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sms_opt_outs")
        .update({
          restored_at: new Date().toISOString(),
          restored_by: user!.id,
          notes: "Manually restored by admin",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Number restored. They can receive messages again.");
      qc.invalidateQueries({ queryKey: ["sms-opt-outs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reOptOut = useMutation({
    mutationFn: async (row: OptOut) => {
      const { error } = await supabase
        .from("sms_opt_outs")
        .update({
          restored_at: null,
          restored_by: null,
          opted_out_at: new Date().toISOString(),
          notes: "Re-suppressed by admin",
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Number suppressed again.");
      qc.invalidateQueries({ queryKey: ["sms-opt-outs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sms_opt_outs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record deleted.");
      qc.invalidateQueries({ queryKey: ["sms-opt-outs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleLoading) {
    return <div className="p-8 text-sm text-[var(--w45)]">Checking permissions…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-16 surface p-8 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-[var(--w55)] mb-3" />
        <div className="h-display text-2xl">Admins only</div>
        <p className="text-sm text-[var(--w55)] mt-2">
          You need the <code className="font-mono">admin</code> role to view the SMS opt-out registry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow inline-flex">
            <span className="eyebrow-dot" />
            Compliance
          </div>
          <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-3">SMS opt-outs</h1>
          <p className="text-[var(--w55)] mt-2 max-w-2xl">
            Carrier-required suppression list. Numbers here are blocked from all outbound SMS until restored.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setTestDigestOpen(true)}
            disabled={!myEmail}
            title="Send the weekly compliance digest to your own email right now"
          >
            <Send className="h-4 w-4" />
            Send test digest
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportOptOutsCsv(rows)}
            disabled={rows.length === 0}
            title="Export current view to CSV"
          >
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportOptOutsPdf(rows)}
            disabled={rows.length === 0}
            title="Export current view to PDF"
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button onClick={() => setAddOpen(true)} className="btn-primary gap-2">
            <Plus className="h-4 w-4" /> Add opt-out
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["active", "restored", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm border transition ${
              filter === f
                ? "border-cyan text-cyan bg-cyan/5"
                : "border-border text-[var(--w55)] hover:text-foreground"
            }`}
          >
            {f === "active" ? "Active" : f === "restored" ? "Restored" : "All"}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--w45)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone…"
            className="pl-9 w-64"
          />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--w45)] border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Keyword</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Opted out</th>
                <th className="px-4 py-3 font-medium">Restored</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--w45)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--w45)]">
                    No records.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const active = !r.restored_at;
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-mono">{r.phone}</td>
                    <td className="px-4 py-3">
                      {active ? (
                        <Badge variant="destructive" className="gap-1">
                          <Ban className="h-3 w-3" /> Blocked
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Restored</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--w55)]">{r.keyword ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--w55)]">{r.source}</td>
                    <td className="px-4 py-3 text-[var(--w55)]">
                      {new Date(r.opted_out_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[var(--w55)]">
                      {r.restored_at ? new Date(r.restored_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => restore.mutate(r.id)}
                            disabled={restore.isPending}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => reOptOut.mutate(r)}
                            disabled={reOptOut.isPending}
                          >
                            <Ban className="h-3.5 w-3.5" /> Re-suppress
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete opt-out record for ${r.phone}? This is permanent.`)) {
                              remove.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddOptOutDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddOptOutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("sms_opt_outs").upsert(
      {
        phone: phone.trim(),
        source: "manual",
        keyword: "MANUAL",
        notes: notes.trim() || null,
      },
      { onConflict: "phone" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Added to suppression list.");
    qc.invalidateQueries({ queryKey: ["sms-opt-outs"] });
    setPhone("");
    setNotes("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add manual opt-out</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[var(--w55)] mb-1 block">Phone (E.164)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+13475727845"
              required
            />
          </div>
          <div>
            <label className="text-xs text-[var(--w55)] mb-1 block">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why is this number being suppressed?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Add opt-out"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={testDigestOpen} onOpenChange={setTestDigestOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send test compliance digest</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-[var(--w55)]">
            This will render the current weekly digest and email it only to your verified admin address:
          </p>
          <div className="surface p-3 font-mono text-sm break-all">
            {myEmail ?? "—"}
          </div>
          <p className="text-xs text-[var(--w45)]">
            The subject is prefixed with <span className="font-mono">[TEST]</span>. This does not affect
            the scheduled Monday digest or the dashboard snapshot.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTestDigestOpen(false)} disabled={sendTestDigest.isPending}>
            Cancel
          </Button>
          <Button
            className="btn-primary"
            onClick={() => sendTestDigest.mutate()}
            disabled={!myEmail || sendTestDigest.isPending}
          >
            {sendTestDigest.isPending ? "Sending…" : `Send to ${myEmail ?? ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
