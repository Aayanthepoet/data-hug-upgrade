import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, KeyRound, ExternalLink, Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAttomStatus } from "@/lib/distress/attom-status.functions";

export const Route = createFileRoute("/_authenticated/app/settings/integrations")({
  head: () => ({ meta: [{ title: "Integrations — PropAI" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const fetchStatus = useServerFn(getAttomStatus);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["attom-status"],
    queryFn: () => fetchStatus(),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-[var(--w55)]">
          Connect external data providers to unlock nationwide, real-time property data.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card/40 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> ATTOM Data API
            </h2>
            <p className="text-sm text-[var(--w55)] mt-1">
              Real-time US property records — ownership, valuations, tax, equity, foreclosure,
              and distress signals — covering 158M+ parcels nationwide.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--w55)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
          </div>
        ) : (
          <StatusPanel data={data} />
        )}

        <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3 text-sm">
          <p className="font-medium">How to enable real-time US search</p>
          <ol className="list-decimal list-inside space-y-1.5 text-[var(--w55)]">
            <li>
              Create an ATTOM developer account and request an API key at{" "}
              <a
                href="https://api.developer.attomdata.com/signup"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline inline-flex items-center gap-1"
              >
                api.developer.attomdata.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Choose a plan (a free trial key works for testing).</li>
            <li>Copy your API key from the ATTOM dashboard.</li>
            <li>Click the button below — your key is stored securely as an encrypted backend secret.</li>
          </ol>
        </div>

        {data?.isAdmin === false && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-sm">
            <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-amber-200">
              Only workspace admins can manage integration credentials. Contact your admin to add the ATTOM API key.
            </div>
          </div>
        )}

        {data?.isAdmin && (
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                // Triggers the Lovable secret form in chat
                window.dispatchEvent(
                  new CustomEvent("lovable:request-secret", { detail: { names: ["ATTOM_API_KEY"] } }),
                );
                window.open(
                  "https://api.developer.attomdata.com/signup",
                  "_blank",
                  "noopener,noreferrer",
                );
                // Fallback prompt to the user
                alert(
                  data?.configured
                    ? "To rotate your ATTOM API key, ask the assistant: \"Update my ATTOM_API_KEY secret.\""
                    : "To add your ATTOM API key, ask the assistant: \"Add my ATTOM_API_KEY secret\" — you'll get a secure form to paste it.",
                );
              }}
            >
              {data?.configured ? "Rotate API Key" : "Add ATTOM API Key"}
            </Button>
            {data?.configured && (
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                Test connection
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-6 space-y-2">
        <h2 className="text-lg font-semibold">What changes when ATTOM is connected?</h2>
        <ul className="text-sm text-[var(--w55)] space-y-1.5 list-disc list-inside">
          <li>Nationwide US ZIP / city + state search returns live property records.</li>
          <li>Distress signals (preforeclosure, tax delinquent, vacancy, absentee owner) come from real data.</li>
          <li>NYC and Philadelphia continue to use their free public data sources.</li>
          <li>If ATTOM is unavailable, the system gracefully falls back to the simulator.</li>
        </ul>
      </section>
    </div>
  );
}

function StatusPanel({
  data,
}: {
  data: { configured: boolean; live: boolean; error: string | null; maskedKey: string | null } | undefined;
}) {
  if (!data) return null;
  if (!data.configured) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
        <XCircle className="h-4 w-4 text-[var(--w45)]" />
        <span className="text-[var(--w55)]">Not connected — using free NYC / Philadelphia data + simulator elsewhere.</span>
      </div>
    );
  }
  if (data.live) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm">
        <div className="flex items-center gap-2 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Connected — real-time US search active</span>
        </div>
        {data.maskedKey && <code className="text-xs text-emerald-400/70">{data.maskedKey}</code>}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-sm space-y-1">
      <div className="flex items-center gap-2 text-red-300">
        <XCircle className="h-4 w-4" />
        <span className="font-medium">Key configured but ATTOM rejected the request</span>
      </div>
      {data.error && <p className="text-red-300/80 text-xs pl-6">{data.error}</p>}
    </div>
  );
}
