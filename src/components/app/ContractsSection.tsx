import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileSignature, Loader2, Download, ExternalLink, Ban, ListChecks } from "lucide-react";

import {
  createContract,
  listContractsForProperty,
  getContractPdfUrl,
  cancelContract,
} from "@/lib/contracts/contracts.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type ContractRow = {
  id: string;
  buyer_name: string;
  seller_name: string;
  purchase_price: number | string;
  closing_date: string;
  status: string;
  pdf_storage_path: string | null;
  signed_pdf_storage_path: string | null;
  signwell_document_id: string | null;
  signed_pdf_url: string | null;
  signed_at: string | null;
  error_message: string | null;
  created_at: string;
};


const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  sent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  viewed: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  signed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  declined: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  error: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border " +
        (STATUS_COLORS[status] ?? STATUS_COLORS.draft)
      }
    >
      {status}
    </span>
  );
}

export function ContractsSection({
  propertyId,
  defaultBuyer,
  defaultSeller,
  defaultPrice,
}: {
  propertyId: string;
  defaultBuyer?: string;
  defaultSeller?: string;
  defaultPrice?: number | null;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listContractsForProperty);
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", propertyId],
    queryFn: () => listFn({ data: { property_id: propertyId } }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["contracts", propertyId] });

  return (
    <section className="surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--w55)]">
            Purchase contracts
          </h2>
          <p className="text-xs text-[var(--w55)] mt-1">
            Generate a cash-purchase agreement PDF. Optionally send it for
            e-signature via SignWell.
          </p>
        </div>
        <CreateContractDialog
          propertyId={propertyId}
          defaultBuyer={defaultBuyer}
          defaultSeller={defaultSeller}
          defaultPrice={defaultPrice}
          onCreated={invalidate}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--w55)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contracts…
        </div>
      ) : contracts.length === 0 ? (
        <p className="text-xs text-[var(--w55)]">
          No contracts yet for this property.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(contracts as ContractRow[]).map((c) => (
            <ContractRowItem key={c.id} contract={c} onChanged={invalidate} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ContractRowItem({
  contract,
  onChanged,
}: {
  contract: ContractRow;
  onChanged: () => void;
}) {
  const pdfFn = useServerFn(getContractPdfUrl);
  const cancelFn = useServerFn(cancelContract);

  const dl = useMutation({
    mutationFn: () => pdfFn({ data: { contract_id: contract.id } }),
    onSuccess: (r) => {
      window.open(r.url, "_blank", "noopener");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { contract_id: contract.id } }),
    onSuccess: () => {
      toast.success("Contract cancelled");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canCancel = !["signed", "cancelled", "declined"].includes(contract.status);

  return (
    <li className="flex items-center justify-between gap-3 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={contract.status} />
          <span className="font-medium truncate">
            {contract.buyer_name} ← {contract.seller_name}
          </span>
        </div>
        <div className="mt-1 text-xs text-[var(--w55)] flex items-center gap-3 flex-wrap">
          <span>
            $
            {Number(contract.purchase_price).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </span>
          <span>Closing {contract.closing_date}</span>
          <span>Created {new Date(contract.created_at).toLocaleDateString()}</span>
          {contract.error_message && (
            <span className="text-amber-400">· {contract.error_message}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button asChild variant="ghost" size="sm" title="View signing status">
          <Link to="/app/contracts/$contractId" params={{ contractId: contract.id }}>
            <ListChecks className="h-3.5 w-3.5" />
          </Link>
        </Button>
        {contract.pdf_storage_path && (

          <Button
            variant="outline"
            size="sm"
            disabled={dl.isPending}
            onClick={() => dl.mutate()}
            title={contract.signed_pdf_storage_path ? "Open signed PDF" : "Open PDF"}
          >
            {dl.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : contract.signed_pdf_storage_path ? (
              <ExternalLink className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>

        )}
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
            title="Cancel contract"
            className="text-red-400 hover:text-red-300"
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}

function CreateContractDialog({
  propertyId,
  defaultBuyer,
  defaultSeller,
  defaultPrice,
  onCreated,
}: {
  propertyId: string;
  defaultBuyer?: string;
  defaultSeller?: string;
  defaultPrice?: number | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [buyer, setBuyer] = useState(defaultBuyer ?? "");
  const [seller, setSeller] = useState(defaultSeller ?? "");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [price, setPrice] = useState<string>(defaultPrice ? String(defaultPrice) : "");
  const [closing, setClosing] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [sendForSig, setSendForSig] = useState(false);

  const createFn = useServerFn(createContract);
  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          property_id: propertyId,
          buyer_name: buyer.trim(),
          seller_name: seller.trim(),
          buyer_email: sendForSig ? buyerEmail.trim() : null,
          seller_email: sendForSig ? sellerEmail.trim() : null,
          purchase_price: Number(price),
          closing_date: closing,
          send_for_signature: sendForSig,
        },
      }),
    onSuccess: () => {
      toast.success(sendForSig ? "Contract sent for e-signature" : "Contract PDF generated");
      onCreated();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const priceNum = Number(price);
  const invalid =
    !buyer.trim() ||
    !seller.trim() ||
    !Number.isFinite(priceNum) ||
    priceNum < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(closing) ||
    (sendForSig &&
      (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail) ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sellerEmail)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <FileSignature className="h-3.5 w-3.5" /> Create contract
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New purchase contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="buyer">Buyer</Label>
              <Input
                id="buyer"
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                placeholder="Buyer full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seller">Seller</Label>
              <Input
                id="seller"
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                placeholder="Seller full name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Purchase price (USD)</Label>
              <Input
                id="price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closing">Closing date</Label>
              <Input
                id="closing"
                type="date"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Send for e-signature</div>
              <div className="text-xs text-[var(--w55)]">
                Email both parties to sign via SignWell. Requires
                SIGNWELL_API_KEY.
              </div>
            </div>
            <Switch checked={sendForSig} onCheckedChange={setSendForSig} />
          </div>

          {sendForSig && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="buyer_email">Buyer email</Label>
                <Input
                  id="buyer_email"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="buyer@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seller_email">Seller email</Label>
                <Input
                  id="seller_email"
                  type="email"
                  value={sellerEmail}
                  onChange={(e) => setSellerEmail(e.target.value)}
                  placeholder="seller@example.com"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={invalid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {sendForSig ? "Generate & send" : "Generate PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
