import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, XCircle, KeyRound, ExternalLink, Loader2, ShieldAlert, RefreshCw, MapPin, PauseCircle, Database, PlayCircle, UserCog, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getAttomStatus, testAttomConnection } from "@/lib/distress/attom-status.functions";
import { backfillLocations, type BackfillResult } from "@/lib/location-backfill.functions";
import { runDistressSyncNow, getRecentSyncRuns, type SyncRunRow } from "@/lib/distress/sync.functions";
import {
  listMySkiptraceCredentials,
  upsertSkiptraceCredential,
  deleteSkiptraceCredential,
  testSkiptraceCredential,
} from "@/lib/skiptrace/credentials.functions";

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

      <SkiptraceProvidersSection />

      <DistressSyncSection />

      <LocationBackfillSection />
    </div>
  );
}

function DistressSyncSection() {
  const runNow = useServerFn(runDistressSyncNow);
  const fetchRuns = useServerFn(getRecentSyncRuns);
  const [busy, setBusy] = useState(false);

  const { data: runs, refetch, isFetching } = useQuery<SyncRunRow[]>({
    queryKey: ["sync-runs"],
    queryFn: () => fetchRuns(),
    staleTime: 30_000,
  });

  async function onRun() {
    setBusy(true);
    try {
      const r = await runNow();
      const totals = r.summaries.reduce(
        (acc, s) => ({ ins: acc.ins + s.inserted, upd: acc.upd + s.updated }),
        { ins: 0, upd: 0 },
      );
      toast.success(`Sync complete — ${totals.ins} added, ${totals.upd} updated`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  // Latest run per provider
  const latestByProvider = new Map<string, SyncRunRow>();
  for (const r of runs ?? []) {
    if (!latestByProvider.has(r.provider)) latestByProvider.set(r.provider, r);
  }

  return (
    <section className="rounded-xl border border-border bg-card/40 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" /> Nightly distress data sync
          </h2>
          <p className="text-sm text-[var(--w55)] mt-1">
            Pulls fresh pre-foreclosure / distress records every night from free NYC
            (Socrata) &amp; Philadelphia (Carto) public data into your properties table.
            Only manages rows it created — your manual entries and saved properties are
            never touched. ZIP list is edited in{" "}
            <code className="text-xs">src/lib/distress/sync-config.ts</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" onClick={onRun} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <PlayCircle className="h-3.5 w-3.5 mr-1.5" />}
            {busy ? "Running…" : "Run sync now"}
          </Button>
        </div>
      </div>

      {latestByProvider.size === 0 ? (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm text-[var(--w55)]">
          No sync runs yet. Click "Run sync now" to pull the first batch.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from(latestByProvider.values()).map((r) => (
            <SyncRunCard key={r.provider} run={r} />
          ))}
        </div>
      )}

      {runs && runs.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--w55)] hover:text-[var(--w85)]">
            Show recent run history
          </summary>
          <div className="mt-2 rounded border border-border/60 bg-background/40 divide-y divide-border/60">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-[var(--w55)]">
                <span>
                  <span className="text-[var(--w85)] font-medium">{r.provider}</span>{" "}
                  · {new Date(r.started_at).toLocaleString()} · {r.triggered_by}
                </span>
                <span>
                  +{r.inserted} / ~{r.updated}
                  {r.error && <span className="text-red-400 ml-2">error</span>}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function SyncRunCard({ run }: { run: SyncRunRow }) {
  const ok = !run.error;
  return (
    <div className={`rounded-lg border p-3 text-sm ${ok ? "border-border/60 bg-background/40" : "border-red-900/40 bg-red-950/10"}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{run.provider}</span>
        <span className="text-xs text-[var(--w55)]">
          {run.finished_at ? new Date(run.finished_at).toLocaleString() : "running…"}
        </span>
      </div>
      <div className="mt-1 text-xs text-[var(--w55)]">
        <span className="text-emerald-400">+{run.inserted} added</span>
        {" · "}
        <span className="text-cyan-400">~{run.updated} updated</span>
        {run.skipped > 0 && <> · {run.skipped} skipped</>}
        {" · "}
        <span>via {run.triggered_by}</span>
      </div>
      {run.error && <div className="mt-1 text-xs text-red-300">{run.error}</div>}
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

type SkiptraceProviderId = "batchdata" | "idi" | "tlo" | "reiskip" | "whitepages";

type SkiptraceCredentialRow = {
  id: string;
  provider: SkiptraceProviderId;
  label: string | null;
  api_key_last4: string | null;
  is_active: boolean;
  created_at: string;
};

function SkiptraceProvidersSection() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMySkiptraceCredentials);
  const upsert = useServerFn(upsertSkiptraceCredential);
  const remove = useServerFn(deleteSkiptraceCredential);
  const test = useServerFn(testSkiptraceCredential);

  const { data, isLoading } = useQuery({
    queryKey: ["skiptrace-creds"],
    queryFn: () => fetchList(),
    staleTime: 60_000,
  });

  const [provider, setProvider] = useState<SkiptraceProviderId>("batchdata");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const labels = data?.providerLabels ?? {};
  const available = data?.providerAvailable ?? {};
  const creds: SkiptraceCredentialRow[] = (data?.credentials ?? []) as SkiptraceCredentialRow[];

  async function onSave() {
    if (!apiKey.trim()) {
      toast.error("Enter your provider API key");
      return;
    }
    setBusy(true);
    try {
      await upsert({ data: { provider, apiKey: apiKey.trim(), label: label.trim() || null } });
      toast.success(`${(labels as Record<string, string>)[provider] ?? provider} key saved`);
      setApiKey("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["skiptrace-creds"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save key");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this stored skip-trace key?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Key removed");
      qc.invalidateQueries({ queryKey: ["skiptrace-creds"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }

  async function onTest(row: SkiptraceCredentialRow) {
    setTestingId(row.id);
    try {
      const r = await test({ data: { provider: row.provider } });
      if (r.ok) toast.success(`${(labels as Record<string, string>)[row.provider] ?? row.provider} key OK`);
      else toast.error(r.error ?? "Test failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/40 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UserCog className="h-4 w-4" /> Skip-Trace Providers
        </h2>
        <p className="text-sm text-[var(--w55)] mt-1">
          Connect your own skip-trace account so contact lookups return real, verified
          phones and emails. Without a key, PropAI uses a clearly-labeled{" "}
          <span className="text-amber-300">SAMPLE / Do Not Contact</span> stub so you can
          test the flow safely.
        </p>
        <p className="text-xs text-amber-300 mt-2">
          Lookups bill directly to your own provider account. PropAI does not proxy or
          surcharge skip-trace usage.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--w55)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : creds.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
          <XCircle className="h-4 w-4 text-[var(--w45)]" />
          <span className="text-[var(--w55)]">
            No skip-trace provider connected — using SAMPLE stub (results flagged
            "Do Not Contact").
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {creds.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm"
            >
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">
                  {(labels as Record<string, string>)[c.provider] ?? c.provider}
                </span>
                {c.label && <span className="text-[var(--w55)]">· {c.label}</span>}
                {c.api_key_last4 && (
                  <code className="text-xs text-[var(--w55)]">····{c.api_key_last4}</code>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTest(c)}
                  disabled={testingId === c.id}
                >
                  {testingId === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
        <p className="text-sm font-medium">Connect a provider</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-[var(--w55)] mb-1 block">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as SkiptraceProviderId)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {(["batchdata", "idi", "tlo", "reiskip", "whitepages"] as SkiptraceProviderId[]).map((p) => (
                <option key={p} value={p} disabled={!(available as Record<string, boolean>)[p]}>
                  {(labels as Record<string, string>)[p] ?? p}
                  {!(available as Record<string, boolean>)[p] ? " (coming soon)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--w55)] mb-1 block">API key</label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="paste your provider API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--w55)] mb-1 block">Label (optional)</label>
            <Input
              placeholder="e.g. Main account"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <KeyRound className="h-3.5 w-3.5 mr-1.5" />}
            Save key
          </Button>
          <a
            href="https://docs.batchdata.com/reference/skip-trace"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            BatchData API docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-[var(--w45)] flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3" />
          Keys are encrypted at rest and only readable by you. PropAI never logs the
          plaintext value and never exposes it client-side.
        </p>
      </div>
    </section>
  );
}
