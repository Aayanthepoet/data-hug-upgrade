import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Download, FileText, Mail } from "lucide-react";
import { useTeamMembers, memberLabel } from "@/hooks/use-team-members";
import { jsPDF } from "jspdf";

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
  assigned_to: string | null;
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

  const historyQuery = useQuery({
    queryKey: ["lead-assignments", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_assignments").select("*").eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        assigned_to: string | null;
        assigned_by: string | null;
        created_at: string;
      }>;
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

  const { data: members = [] } = useTeamMembers();
  const updateAssignee = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const { error } = await supabase
        .from("leads").update({ assigned_to: assigneeId }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-assignments", leadId] });
      toast.success("Assignment updated");
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

  function handleExportCsv() {
    const memberName = (id: string | null) =>
      id ? memberLabel(members.find((m) => m.id === id)) : "Unassigned";
    const lines: string[][] = [];
    lines.push(["Section", "Field", "Value"]);
    lines.push(["Lead", "ID", lead!.id]);
    lines.push(["Lead", "Name", lead!.full_name ?? ""]);
    lines.push(["Lead", "Email", lead!.email ?? ""]);
    lines.push(["Lead", "Phone", lead!.phone ?? ""]);
    lines.push(["Lead", "Company", lead!.company ?? ""]);
    lines.push(["Lead", "Source", lead!.source ?? ""]);
    lines.push(["Lead", "Status", lead!.status ?? ""]);
    lines.push(["Lead", "Assignee", memberName(lead!.assigned_to)]);
    lines.push(["Lead", "Message", lead!.message ?? ""]);
    lines.push(["Lead", "Submitted", lead!.created_at]);
    lines.push([]);
    lines.push(["Assignment history", "When", "Assigned to", "Assigned by"]);
    (historyQuery.data ?? []).forEach((h) => {
      lines.push([
        "Assignment",
        h.created_at,
        memberName(h.assigned_to),
        h.assigned_by ? memberName(h.assigned_by) : "system",
      ]);
    });
    downloadCsv(`lead-${lead!.id}.csv`, lines);
  }

  function buildPdfDoc() {
    const memberName = (id: string | null) =>
      id ? memberLabel(members.find((m) => m.id === id)) : "Unassigned";

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 56;
    let y = 64;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 56) {
        doc.addPage();
        y = 64;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Lead Summary", marginX, y);
    y += 26;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}`, marginX, y);
    y += 24;
    doc.setTextColor(0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(lead!.full_name || "Unnamed lead", marginX, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      `Submitted ${new Date(lead!.created_at).toLocaleString()}${lead!.source ? ` · via ${lead!.source}` : ""}`,
      marginX,
      y,
    );
    y += 24;
    doc.setTextColor(0);

    const drawSectionTitle = (title: string) => {
      ensureSpace(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, marginX, y);
      y += 6;
      doc.setDrawColor(220);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 14;
    };

    const drawRow = (label: string, value: string) => {
      const labelW = 110;
      const valueW = pageWidth - marginX * 2 - labelW;
      const wrapped = doc.splitTextToSize(value || "—", valueW);
      const rowH = Math.max(14, wrapped.length * 12 + 2);
      ensureSpace(rowH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(label, marginX, y + 10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(wrapped, marginX + labelW, y + 10);
      y += rowH;
    };

    drawSectionTitle("Lead details");
    drawRow("Name", lead!.full_name ?? "");
    drawRow("Email", lead!.email ?? "");
    drawRow("Phone", lead!.phone ?? "");
    drawRow("Company", lead!.company ?? "");
    drawRow("Source", lead!.source ?? "");
    drawRow("Status", lead!.status ?? "new");
    drawRow("Assignee", memberName(lead!.assigned_to));
    drawRow("Lead ID", lead!.id);
    y += 8;
    drawSectionTitle("Message");
    const msg = lead!.message?.trim() || "No message provided.";
    const msgLines = doc.splitTextToSize(msg, pageWidth - marginX * 2);
    ensureSpace(msgLines.length * 12 + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(msgLines, marginX, y + 10);
    y += msgLines.length * 12 + 16;

    drawSectionTitle("Assignment history");
    const history = historyQuery.data ?? [];
    if (history.length === 0) {
      ensureSpace(16);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text("No assignment changes yet.", marginX, y + 10);
      doc.setTextColor(0);
      y += 18;
    } else {
      history.forEach((h) => {
        const when = new Date(h.created_at).toLocaleString();
        const to = h.assigned_to ? memberName(h.assigned_to) : "Unassigned";
        const by = h.assigned_by ? memberName(h.assigned_by) : "system";
        const line = `Assigned to ${to}  ·  by ${by}`;
        ensureSpace(28);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.text(when, marginX, y + 10);
        doc.setTextColor(0);
        doc.text(line, marginX, y + 24);
        y += 32;
      });
    }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pages}`, pageWidth - marginX, pageHeight - 32, { align: "right" });
      doc.text("PropAI — Lead Summary", marginX, pageHeight - 32);
    }

    return doc;
  }

  function handleExportPdf() {
    buildPdfDoc().save(`lead-${lead!.id}.pdf`);
  }

  const [emailOpen, setEmailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [emailNote, setEmailNote] = useState("");
  const [sending, setSending] = useState(false);

  const recipientCandidates = members.filter((m) => !!m.email);

  function toggleRecipient(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSendEmail() {
    if (selectedIds.length === 0) {
      toast.error("Pick at least one recipient");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("You must be signed in");
      return;
    }
    setSending(true);
    try {
      // 1. Build PDF
      const doc = buildPdfDoc();
      const blob = doc.output("blob");

      // 2. Upload to private storage
      const path = `${lead!.id}/${Date.now()}-lead-summary.pdf`;
      const { error: upErr } = await supabase
        .storage.from("lead-exports")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      // 3. Signed URL valid for 7 days
      const { data: signed, error: signErr } = await supabase
        .storage.from("lead-exports")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signErr || !signed) throw signErr ?? new Error("Failed to sign URL");

      const sharedBy =
        user?.user_metadata?.full_name ||
        user?.email ||
        "A teammate";
      const leadName = lead!.full_name || lead!.email || "a lead";

      // 4. Send to each selected recipient
      const recipients = recipientCandidates.filter((m) => selectedIds.includes(m.id));
      const results = await Promise.allSettled(
        recipients.map((m) =>
          fetch("/lovable/email/transactional/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              templateName: "lead-pdf-summary",
              recipientEmail: m.email,
              idempotencyKey: `lead-pdf-${lead!.id}-${path}-${m.id}`,
              templateData: {
                leadName,
                sharedBy,
                downloadUrl: signed.signedUrl,
                note: emailNote.trim() || undefined,
              },
            }),
          }).then(async (res) => {
            if (!res.ok) throw new Error(await res.text());
            return res.json();
          }),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok > 0) toast.success(`Emailed PDF to ${ok} recipient${ok === 1 ? "" : "s"}`);
      if (failed > 0) toast.error(`${failed} email${failed === 1 ? "" : "s"} failed to send`);

      if (failed === 0) {
        setEmailOpen(false);
        setSelectedIds([]);
        setEmailNote("");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send email");
    } finally {
      setSending(false);
    }
  }


  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link to="/app/leads" className="text-sm text-cyan hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3 mt-3">
          <div>
            <h1 className="text-3xl font-bold">{lead.full_name || "Unnamed lead"}</h1>
            <p className="text-sm text-[var(--w55)] mt-1">
              Submitted {new Date(lead.created_at).toLocaleString()}
              {lead.source ? ` · via ${lead.source}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportCsv} className="gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={handleExportPdf} className="gap-2">
              <FileText className="h-4 w-4" /> Download PDF
            </Button>
            <Button variant="outline" onClick={() => setEmailOpen(true)} className="gap-2">
              <Mail className="h-4 w-4" /> Email PDF
            </Button>

            <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Email lead PDF</DialogTitle>
                  <DialogDescription>
                    Pick the team members to send the generated PDF to. They'll get a private download link valid for 7 days.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wider text-[var(--w55)]">
                    Recipients
                  </div>
                  {recipientCandidates.length === 0 ? (
                    <p className="text-sm text-[var(--w55)]">
                      No teammates with an email address found.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 rounded-md border border-border p-3">
                      {recipientCandidates.map((m) => {
                        const checked = selectedIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            htmlFor={`mail-${m.id}`}
                            className="flex items-start gap-3 cursor-pointer"
                          >
                            <Checkbox
                              id={`mail-${m.id}`}
                              checked={checked}
                              onCheckedChange={() => toggleRecipient(m.id)}
                            />
                            <div className="text-sm leading-tight">
                              <div>{memberLabel(m)}</div>
                              <div className="text-xs text-[var(--w55)]">{m.email}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="email-note" className="text-xs uppercase tracking-wider text-[var(--w55)]">
                      Optional note
                    </Label>
                    <Textarea
                      id="email-note"
                      rows={3}
                      placeholder="Add a quick message for your teammates…"
                      value={emailNote}
                      onChange={(e) => setEmailNote(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setEmailOpen(false)} disabled={sending}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={sending || selectedIds.length === 0}
                    className="gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {sending ? "Sending…" : `Send to ${selectedIds.length || ""}`.trim()}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
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
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="text-xs uppercase tracking-wider text-[var(--w55)]">Status</div>
          <Select
            value={lead.status || "new"}
            onValueChange={(v) => updateStatus.mutate(v)}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="text-xs uppercase tracking-wider text-[var(--w55)] ml-2">Assignee</div>
          <Select
            value={lead.assigned_to ?? "unassigned"}
            onValueChange={(v) => updateAssignee.mutate(v === "unassigned" ? null : v)}
          >
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Assignment history</h2>
        {historyQuery.isLoading ? (
          <p className="text-sm text-[var(--w55)]">Loading history…</p>
        ) : (historyQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--w55)]">No assignment changes yet.</p>
        ) : (
          <ol className="border border-border rounded-md divide-y divide-border">
            {historyQuery.data!.map((h) => {
              const assignee = h.assigned_to ? members.find((m) => m.id === h.assigned_to) : null;
              const by = h.assigned_by ? members.find((m) => m.id === h.assigned_by) : null;
              return (
                <li key={h.id} className="px-4 py-3 text-sm flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    Assigned to{" "}
                    <span className="font-medium">
                      {h.assigned_to ? memberLabel(assignee) : "Unassigned"}
                    </span>
                    {" "}by{" "}
                    <span className="font-medium">
                      {h.assigned_by ? memberLabel(by) : "system"}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--w55)] whitespace-nowrap">
                    {new Date(h.created_at).toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ol>
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

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
