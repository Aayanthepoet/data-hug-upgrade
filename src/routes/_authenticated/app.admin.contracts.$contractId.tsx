import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  getContractAdmin,
  sendContractFollowupAdmin,
} from "@/lib/contracts/admin.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute(
  "/_authenticated/app/admin/contracts/$contractId",
)({
  component: AdminContractDetailPage,
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
    <div className="p-6 text-sm text-[var(--w55)]">Contract not found.</div>
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

function AdminContractDetailPage() {
  const { contractId } = Route.useParams();
  const getFn = useServerFn(getContractAdmin);
  const followupFn = useServerFn(sendContractFollowupAdmin);
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "contract", contractId],
    queryFn: () => getFn({ data: { contractId } }),
  });

  const followup = useMutation({
    mutationFn: () =>
      followupFn({ data: { contractId, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Follow-up sent to owner");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "contract", contractId] });
      qc.invalidateQueries({ queryKey: ["admin", "contracts-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-[var(--w55)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading contract…
      </div>
    );
  }

  const { contract, property, owner } = data;
  const tone = STATUS_TONE[String(contract.status)] ?? STATUS_TONE.draft;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          to="/app/admin/contracts"
          className="text-xs text-[var(--w55)] hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to admin contracts
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">
            {contract.buyer_name} ← {contract.seller_name}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
            <span
              className={
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border " +
                tone
              }
            >
              {contract.status}
            </span>
            <span className="text-[var(--w55)] tabular-nums">
              updated {new Date(String(contract.updated_at)).toLocaleString()}
            </span>
            {contract.signed_at && (
              <span className="text-emerald-300 tabular-nums">
                signed {new Date(String(contract.signed_at)).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <Link
          to="/app/contracts/$contractId"
          params={{ contractId }}
          className="text-xs text-blue-300 hover:underline"
        >
          Open user view →
        </Link>
      </header>

      {contract.error_message && (
        <div className="surface p-4 border-amber-500/40 bg-amber-500/5">
          <h3 className="text-xs uppercase tracking-wider text-amber-300 mb-1">
            Last error
          </h3>
          <p className="text-sm text-amber-200 break-words">
            {contract.error_message}
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Buyer" value={contract.buyer_name} sub={contract.buyer_email} />
        <Field label="Seller" value={contract.seller_name} sub={contract.seller_email} />
        <Field
          label="Purchase price"
          value={
            contract.purchase_price != null
              ? "$" +
                Number(contract.purchase_price).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })
              : "—"
          }
        />
        <Field
          label="Closing date"
          value={
            contract.closing_date
              ? new Date(String(contract.closing_date)).toLocaleDateString()
              : "—"
          }
        />
        <Field
          label="SignWell document"
          value={contract.signwell_document_id ?? "—"}
        />
        <Field
          label="Signed archive"
          value={contract.signed_pdf_storage_path ? "Stored" : "Missing"}
          tone={contract.signed_pdf_storage_path ? undefined : "warn"}
        />
      </section>

      {property && (
        <section className="surface p-4">
          <h3 className="text-xs uppercase tracking-wider text-[var(--w55)] mb-2">
            Property
          </h3>
          <p className="text-sm">
            {property.address}, {property.city}, {property.state} {property.zip}
          </p>
          {property.estimated_value != null && (
            <p className="text-xs text-[var(--w55)] mt-1 tabular-nums">
              Est. value $
              {Number(property.estimated_value).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          )}
        </section>
      )}

      <section className="surface p-4">
        <h3 className="text-xs uppercase tracking-wider text-[var(--w55)] mb-2">
          Contract owner
        </h3>
        <p className="text-sm">{owner?.full_name || "—"}</p>
        <p className="text-xs text-[var(--w55)]">{owner?.email || String(contract.user_id)}</p>
      </section>

      <section className="surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">Send follow-up</h3>
            <p className="text-xs text-[var(--w55)]">
              Notifies the contract owner inside PropAI to chase this contract.
            </p>
          </div>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for the owner (defaults to a generic nudge)"
          rows={3}
          maxLength={500}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={followup.isPending}
            onClick={() => followup.mutate()}
          >
            {followup.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            Send follow-up
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | null | undefined;
  sub?: string | null;
  tone?: "warn";
}) {
  const toneCls =
    tone === "warn"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-200"
      : "border-border bg-muted/10";
  return (
    <div className={"rounded-md border p-3 " + toneCls}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--w55)]">
        {label}
      </div>
      <div className="text-sm mt-1 break-words">{value || "—"}</div>
      {sub && <div className="text-xs text-[var(--w55)] mt-0.5 break-words">{sub}</div>}
    </div>
  );
}
