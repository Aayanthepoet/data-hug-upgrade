# Fix distress sync timeout — per-provider execution

## Problem

`runDistressSync()` loops all 10 providers inside one Worker request. HPD Litigations hangs, the Worker hits its execution budget, and the 4 Philly providers never run.

## Approach

Split the run into one Worker request per provider, with a hard per-provider timeout. The orchestrator fans out HTTP calls to a new single-provider hook and aggregates results. Each provider gets its own execution context, so a hang in one can't kill the others.

## Changes (scope-locked: sync execution only)

1. **`src/lib/distress/sync.server.ts`**
   - Extract a new exported `runDistressSyncForProvider(provider, triggeredBy)` that contains the existing per-provider loop body (fetch targets → dedupe → existence check → chunked upsert → write `sync_runs` row). No changes to provider query logic.
   - Wrap the provider's fetch+upsert work in a `Promise.race` against a 50s timeout. On timeout, mark the `sync_runs` row with `error = 'timeout after 50s'` and return a summary so the orchestrator keeps going.
   - Keep `runDistressSync()` as the orchestrator but change its body to fan out: for each provider in `SYNC_TARGETS`, POST to the new single-provider hook in parallel (with a small concurrency cap, e.g. 4) and collect summaries. Each HTTP call is a separate Worker invocation.

2. **New route `src/routes/api/public/hooks/sync-distressed-one.ts`**
   - POST handler, same `CRON_SECRET` `apikey` check as `sync-distressed.ts`.
   - Body: `{ provider: string }`. Calls `runDistressSyncForProvider(provider, 'cron'|'manual')` and returns its summary.

3. **`src/routes/api/public/hooks/sync-distressed.ts`** — unchanged interface; now just calls the orchestrator which fans out.

4. **`src/lib/distress/sync.functions.ts`** — `runDistressSyncNow` unchanged signature; internally calls the orchestrator (which now fans out via HTTP). Admin "Run sync now" button keeps working.

## Per-provider timeout

`Promise.race([work, sleep(50_000).then(() => { throw new Error('timeout after 50s') })])`. The 50s budget keeps each fan-out request well under the Worker limit. Any provider that exceeds it is recorded with `error='timeout after 50s'`, `inserted=0`, `updated=0`, and the orchestrator moves on.

## What does NOT change

- Provider query code (`nyc-signals-provider.server.ts`, `philly-signals-provider.server.ts`, `nyc-provider.server.ts`) — untouched.
- `SYNC_TARGETS`, `PER_TARGET_LIMIT`, schema, RLS, cron schedule, search/detail UI, billing, auth, scorer.

## After applying

Run `runDistressSyncNow` and report per-provider `inserted/updated/error` for all 10 providers (5 NYC + 4 Philly + nyc_opendata).
