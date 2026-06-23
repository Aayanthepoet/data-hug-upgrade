import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  Loader2,
  Send,
  Eye,
  FileSignature,
  Archive,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getContract, getContractPdfUrl } from "@/lib/contracts/contracts.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/contracts/$contractId")({
  component: ContractDetailsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-sm">
        <p className="text-red-400">Failed to load contract: {error.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
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

type Step = {
  key: string;
  label: string;
  icon: typeof Send;
  done: boolean;
  current: boolean;
  at?: string | null;
  hint?: string;
};

function ContractDetailsPage() {
  const { contractId } = Route.useParams();
  const getFn = useServerFn(getContract);
  const pdfFn = useServerFn(getContractPdfUrl);

  const { data: c, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getFn({ data: { contract_id: contractId } }),
    refetchInterval: 15_000,
  });

  const dl = useMutation({
    mutationFn: () => pdfFn({ data: { contract_id: contractId } }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !c) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-[var(--w55)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading contract…
      </div>
    );
  }

  const status = String(c.status);
  const isTerminalNegative = status === "declined" || status === "cancelled";
  const reachedSent = ["sent", "viewed", "signed"].includes(status);
  const reachedViewed = ["viewed", "signed"].includes(status);
  const reachedSigned = Boolean(c.signed_at) || status === "signed";
  const archived = Boolean(c.signed_pdf_storage_path);

  const steps: Step[] = [
    {
      key: "sent",
      label: "Sent",
      icon: Send,
      done: reachedSent,
      current: status === "sent",
      at: reachedSent ? c.created_at : null,
      hint: c.signwell_document_id ? "Delivered to SignWell" : "E-signature not requested",
    },
    {
      key: "viewed",
      label: "Viewed",
      icon: Eye,
      done: reachedViewed,
      current: status === "viewed",
      at: reachedViewed ? c.updated_at : null,
      hint: "Recipient opened the document",
    },
    {
      key: "signed",
      label: "Signed",
      icon: FileSignature,
      done: reachedSigned,
      current: status === "signed" && !archived,
      at: c.signed_at,
      hint: "All parties signed",
    },
    {
      key: "archived",
      label: "PDF archived",
      icon: Archive,
      done: archived,
      current: false,
      at: archived ? c.updated_at : null,
      hint: "Signed PDF saved to your private storage",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <Link
          to="/app/properties/$propertyId"
          params={{ propertyId: c.property_id }}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--w55)] hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to property
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">
              {c.buyer_name} <span className="text-[var(--w55)]">←</span> {c.seller_name}
            </h1>
            <p className="text-xs text-[var(--w55)] mt-1">
              Purchase price $
              {Number(c.purchase_price).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              · Closing {c.closing_date}
            </p>
          </div>
          {c.pdf_storage_path && (
            <Button size="sm" variant="outline" disabled={dl.isPending} onClick={() => dl.mutate()}>
              {dl.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              {archived ? "Open signed PDF" : "Open PDF"}
            </Button>
          )}
        </div>
      </div>

      <section className="surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--w55)] mb-4">
          Signing status
        </h2>

        {isTerminalNegative ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            This contract was {status}.{c.error_message ? ` ${c.error_message}` : ""}
          </div>
        ) : (
          <ol className="relative space-y-5">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const last = i === steps.length - 1;
              return (
                <li key={s.key} className="relative flex gap-3">
                  {!last && (
                    <span
                      aria-hidden
                      className={
                        "absolute left-[15px] top-8 bottom-[-20px] w-px " +
                        (s.done ? "bg-emerald-500/40" : "bg-border")
                      }
                    />
                  )}
                  <div
                    className={
                      "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border " +
                      (s.done
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : s.current
                          ? "border-blue-500/50 bg-blue-500/15 text-blue-300 animate-pulse"
                          : "border-border bg-muted/30 text-[var(--w55)]")
                    }
                  >
                    {s.done ? (
                      <Check className="h-4 w-4" />
                    ) : s.current ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={
                          "text-sm font-medium " +
                          (s.done || s.current ? "" : "text-[var(--w55)]")
                        }
                      >
                        {s.label}
                      </span>
                      {s.at && (
                        <span className="text-xs text-[var(--w55)] tabular-nums">
                          {new Date(s.at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {s.hint && (
                      <p className="text-xs text-[var(--w55)] mt-0.5">{s.hint}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {c.error_message && !isTerminalNegative && (
        <p className="text-xs text-amber-400">{c.error_message}</p>
      )}
    </div>
  );
}
