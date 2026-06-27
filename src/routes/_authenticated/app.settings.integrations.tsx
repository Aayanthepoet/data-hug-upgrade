import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, XCircle, KeyRound, ExternalLink, Loader2, ShieldAlert, RefreshCw, MapPin, PauseCircle, Database, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getAttomStatus, testAttomConnection } from "@/lib/distress/attom-status.functions";
import { backfillLocations, type BackfillResult } from "@/lib/location-backfill.functions";
import { runDistressSyncNow, getRecentSyncRuns, type SyncRunRow } from "@/lib/distress/sync.functions";

export const Route = createFileRoute("/_authenticated/app/settings/integrations")({
  head: () => ({ meta: [{ title: "Integrations — PropAI" }] }),
  component: IntegrationsPage,
});

type AttomInfo = {
  configured: boolean;
  enabled: boolean;
  isAdmin: boolean;
  maskedKey: string | null;
};

type AttomTestResult = {
  live: boolean;
  error: string | null;
  skipped: boolean;
};

function IntegrationsPage() {
  const fetchStatus = useServerFn(getAttomStatus);
  const runTest = useServerFn(testAttomConnection);
  const { data, isLoading } = useQuery<AttomInfo>({
    queryKey: ["attom-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AttomTestResult | null>(null);
  const [revealKey, setRevealKey] = useState(false);

  async function onTest() {
    setTesting(true);
    try {
      const r = await runTest();
      setTestResult(r);
      if (r.skipped) toast.message(r.error ?? "Test skipped");
      else if (r.live) toast.success("ATTOM responded OK");
      else toast.error(r.error ?? "ATTOM test failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

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
              and distress signals — covering 158M+ parcels nationwide.{" "}
              <span className="text-amber-300">Paid API — billable per request.</span>
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--w55)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <StatusPanel
            data={data}
            revealKey={revealKey}
            onReveal={() => setRevealKey(true)}
            testResult={testResult}
          />
        )}

        {data?.isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={testing || !data?.configured}
              title={!data?.enabled ? "ATTOM is disabled. Enable ENABLE_ATTOM=true to send a real test request." : undefined}
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Test ATTOM connection
            </Button>
            <span className="text-xs text-[var(--w55)]">
              Sends exactly one billable request. No request is made on page load.
            </span>
          </div>
        )}

        <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3 text-sm">
          <p className="font-medium">How to enable real-time US search</p>
          <ol className="list-decimal list-inside space-y-1.5 text-[var(--w55)]">
            <li>
              Create an ATTOM developer account at{" "}
              <a
                href="https://api.developer.attomdata.com/signup"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline inline-flex items-center gap-1"
              >
                api.developer.attomdata.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Add your <code>ATTOM_API_KEY</code> as a backend secret.</li>
            <li>Flip the <code>ENABLE_ATTOM</code> secret to <code>true</code> when you're ready to allow billable calls.</li>
          </ol>
        </div>

        {data?.isAdmin === false && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-sm">
            <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-amber-200">
              Only workspace admins can manage integration credentials.
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-6 space-y-2">
        <h2 className="text-lg font-semibold">Coverage</h2>
        <ul className="text-sm text-[var(--w55)] space-y-1.5 list-disc list-inside">
          <li>NYC &amp; Philadelphia use free public data sources (no per-call cost).</li>
          <li>Out-of-coverage ZIPs return an empty state until ATTOM is enabled.</li>
          <li>While ATTOM is disabled, no billable provider is called from search.</li>
        </ul>
      </section>

      <LocationBackfillSection />
    </div>
  );
}

function LocationBackfillSection() {
  const runBackfill = useServerFn(backfillLocations);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);

  async function onRun() {
    setBusy(true);
    try {
      const r = await runBackfill();
      setResult(r);
      toast.success(
        `Backfilled ${r.leads.updated} lead(s) and ${r.properties.updated} property record(s).`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/40 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Backfill neighborhood &amp; market intel locations
          </h2>
          <p className="text-sm text-[var(--w55)] mt-1">
            Parses city, neighborhood, state and ZIP out of existing website leads and
            property addresses, then fills any blank location columns. Existing values
            are never overwritten. Used by the Neighborhood &amp; Market Intel briefings.
          </p>
        </div>
        <Button size="sm" onClick={onRun} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          {busy ? "Running…" : "Run backfill"}
        </Button>
      </div>
      {result && (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm grid grid-cols-2 gap-3">
          <div>
            <div className="text-[var(--w55)] text-xs">Leads</div>
            <div className="font-medium">{result.leads.updated} updated / {result.leads.scanned} scanned</div>
          </div>
          <div>
            <div className="text-[var(--w55)] text-xs">Properties</div>
            <div className="font-medium">{result.properties.updated} updated / {result.properties.scanned} scanned</div>
          </div>
        </div>
      )}
      <p className="text-xs text-[var(--w45)] flex items-center gap-1.5">
        <ShieldAlert className="h-3 w-3" /> Admin only. New website submissions are parsed automatically.
      </p>
    </section>
  );
}

function StatusPanel({
  data,
  revealKey,
  onReveal,
  testResult,
}: {
  data: AttomInfo | undefined;
  revealKey: boolean;
  onReveal: () => void;
  testResult: AttomTestResult | null;
}) {
  if (!data) return null;

  if (!data.configured) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
        <XCircle className="h-4 w-4 text-[var(--w45)]" />
        <span className="text-[var(--w55)]">No ATTOM key set — free NYC / Philadelphia sources only.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
          data.enabled
            ? "border-emerald-900/40 bg-emerald-950/20"
            : "border-amber-900/40 bg-amber-950/20"
        }`}
      >
        <div className={`flex items-center gap-2 ${data.enabled ? "text-emerald-300" : "text-amber-300"}`}>
          {data.enabled ? <CheckCircle2 className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
          <span className="font-medium">
            {data.enabled
              ? "Key configured — ATTOM enabled (billable calls allowed)"
              : "Key configured — ATTOM disabled (no calls being made)"}
          </span>
        </div>
        {data.maskedKey && (
          revealKey ? (
            <code className="text-xs text-[var(--w55)]">{data.maskedKey}</code>
          ) : (
            <button
              type="button"
              onClick={onReveal}
              className="text-xs text-cyan-400 hover:underline"
            >
              Show last 4
            </button>
          )
        )}
      </div>
      {testResult && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            testResult.live
              ? "border-emerald-900/40 bg-emerald-950/10 text-emerald-300"
              : "border-red-900/40 bg-red-950/10 text-red-300"
          }`}
        >
          {testResult.live
            ? "Last test: ATTOM responded OK"
            : `Last test: ${testResult.error ?? "failed"}`}
        </div>
      )}
    </div>
  );
}
