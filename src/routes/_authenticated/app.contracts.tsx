import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, Loader2, ShieldAlert } from "lucide-react";
import { listMyContracts } from "@/lib/contracts/contracts-list.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/contracts")({
  head: () => ({ meta: [{ title: "Contracts — PropAI" }] }),
  component: ContractsListPage,
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
    <div className="p-6 text-sm text-[var(--w55)]">Page not found.</div>
  ),
});

function statusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "signed":
    case "completed":
      return "default";
    case "sent":
    case "pending":
      return "secondary";
    case "error":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function ContractsListPage() {
  const listFn = useServerFn(listMyContracts);
  const { data, isLoading } = useQuery({
    queryKey: ["my-contracts"],
    queryFn: () => listFn(),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--cyan-d)", border: "1px solid var(--cyan-b)" }}
        >
          <FileSignature className="h-4 w-4" style={{ color: "var(--cyan)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Contracts</h1>
          <p className="text-sm text-[var(--w55)]">
            Purchase agreements generated from your properties. Open any contract to download the PDF or send for signature.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--w55)]" />
        </div>
      ) : !data?.length ? (
        <div className="border border-border rounded-lg p-10 text-center">
          <p className="text-sm text-[var(--w55)]">
            You haven't generated any contracts yet. Open a property and click <span className="font-medium text-white">Generate contract</span> to create one.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(255,255,255,.03)] text-left text-xs uppercase tracking-wider text-[var(--w55)]">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Closing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((c: any) => {
                const prop = c.properties;
                const addr = prop
                  ? [prop.address, prop.city, prop.state, prop.zip].filter(Boolean).join(", ")
                  : "—";
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-[rgba(255,255,255,.02)]">
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="font-medium truncate">{addr}</div>
                    </td>
                    <td className="px-4 py-3">{c.buyer_name}</td>
                    <td className="px-4 py-3">{c.seller_name}</td>
                    <td className="px-4 py-3">
                      {typeof c.purchase_price === "number"
                        ? `$${c.purchase_price.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--w55)]">{c.closing_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(c.status)}>{c.status ?? "draft"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--w55)]">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/app/contracts/$contractId" params={{ contractId: c.id }}>
                        <Button size="sm" variant="outline">Open</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
