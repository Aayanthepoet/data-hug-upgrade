## Scope lock

Adds per-user, encrypted, RLS-scoped skip-trace provider credentials and a pluggable adapter layer. Does NOT modify sync, scoring, billing, auth, search, distress providers, or any other feature. Keeps the existing SAMPLE / Do-Not-Contact safety labeling on stub output exactly as-is.

## What gets built

### 1. Database (migration)

New table `public.user_skiptrace_credentials`:

- `id uuid pk`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null check (provider in ('batchdata','idi','tlo','reiskip','whitepages'))`
- `api_key_encrypted bytea not null` — encrypted via `pgsodium`/`vault` style (reuses the same `SOCIAL_TOKEN_ENCRYPTION_KEY` AES-GCM helper already in `src/lib/social-token-crypto.server.ts`)
- `api_key_last4 text` — for UI display only
- `label text` — optional user label
- `is_active boolean default true`
- `created_at`, `updated_at` timestamps
- `unique (user_id, provider)`

GRANT + RLS:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skiptrace_credentials TO authenticated;
GRANT ALL ON public.user_skiptrace_credentials TO service_role;
ALTER TABLE public.user_skiptrace_credentials ENABLE ROW LEVEL SECURITY;
-- Users can only see/modify their own rows
CREATE POLICY "own_select" ON public.user_skiptrace_credentials FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_insert" ON public.user_skiptrace_credentials FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_update" ON public.user_skiptrace_credentials FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_delete" ON public.user_skiptrace_credentials FOR DELETE TO authenticated USING (user_id = auth.uid());
```

No `anon` grant. The encrypted column is server-side only; UI never selects `api_key_encrypted` — only `provider`, `api_key_last4`, `label`, `is_active`.

### 2. Adapter architecture (`src/lib/skiptrace/`)

Existing `SkipTraceProvider` interface stays unchanged. Add:

- `adapters/batchdata.server.ts` — `BatchDataProvider` class implementing `SkipTraceProvider`. Hits `POST https://api.batchdata.com/api/v1/property/skip-trace` with `Authorization: Bearer <userKey>`, maps response (`persons[].phoneNumbers[]`, `emails[]`, `addresses[]`, relatives) to our `SkipTraceContact[]` shape.
- `adapters/index.ts` — registry `{ batchdata: () => new BatchDataProvider(key), idi: ..., ... }` so adding IDI/TLO/REISkip/Whitepages later is one file + one registry line.
- Rework `getSkipTraceProvider()` into `getSkipTraceProviderForUser(userId)` (server-only):
  - Loads the user's active credential via `supabaseAdmin` (server-only decryption),
  - Decrypts the key with the existing AES-GCM helper,
  - Returns the matching adapter,
  - If none → returns existing `MockSkipTraceProvider` (the SAMPLE stub).

### 3. Server functions (`src/lib/skiptrace/credentials.functions.ts`)

- `listMySkiptraceCredentials` — returns `provider, label, api_key_last4, is_active, created_at` only.
- `upsertSkiptraceCredential({ provider, apiKey, label })` — encrypts and stores.
- `deleteSkiptraceCredential({ id })`.
- `testSkiptraceCredential({ provider })` — adapter-level dry-run (no charged call where possible; for BatchData, hits an account/status endpoint).

All use `requireSupabaseAuth`; rows are inserted with `user_id = context.userId`.

### 4. `runSkipTrace` change (one call site only)

In `src/lib/skiptrace/skiptrace.functions.ts`:

- Replace `getSkipTraceProvider()` with `await getSkipTraceProviderForUser(context.userId)`.
- Keep the existing `isSample = result.provider === "mock"` branch verbatim. Real providers return `provider !== "mock"` → contacts insert with `do_not_contact: false`, no `[SAMPLE …]` prefix, real confidence. Mock branch is untouched — SAMPLE labels stay locked on stub data.

### 5. UI (`src/routes/_authenticated/app.settings.integrations.tsx`)

New card modeled on the existing ATTOM card:

- "Skip-Trace Providers" section.
- Provider dropdown (BatchData active; IDI/TLO/REISkip/Whitepages listed as "Coming soon").
- API key input (write-only; never displays the stored value, only last 4).
- Save / Remove / Test buttons.
- Status line: connected provider + last 4.
- Notice: "Skip-trace lookups bill directly to your own provider account. PropAI does not proxy or surcharge."

No changes to the ATTOM card, the sync card, or any other section.

## Verification before applying

- BatchData call shape verified against their public docs (`/api/v1/property/skip-trace`, `Authorization: Bearer`, JSON body with `requests: [{ propertyAddress: { street, city, state, zip } }]`). Response mapping documented in the adapter file as comments.
- No real key is exercised. Adapter is structurally complete and unit-callable; the `testSkiptraceCredential` path validates auth against a non-billing endpoint.

## Files touched (exhaustive)

**New:**
- `supabase` migration for `user_skiptrace_credentials`
- `src/lib/skiptrace/adapters/batchdata.server.ts`
- `src/lib/skiptrace/adapters/index.ts`
- `src/lib/skiptrace/credentials.functions.ts`

**Modified (minimal):**
- `src/lib/skiptrace/mock-provider.server.ts` — add `getSkipTraceProviderForUser(userId)` alongside the existing `getSkipTraceProvider()` (kept for back-compat).
- `src/lib/skiptrace/skiptrace.functions.ts` — swap the one provider lookup line; SAMPLE branch untouched.
- `src/routes/_authenticated/app.settings.integrations.tsx` — add the new card only.

**Not touched:** sync, scoring, billing, auth middleware, search, distress providers, contacts schema, owners schema, ATTOM code paths, mock provider output, SAMPLE labeling.

## Security posture

- Keys stored encrypted at rest using the existing AES-GCM helper (`SOCIAL_TOKEN_ENCRYPTION_KEY`).
- RLS scopes every row to `auth.uid()`; no admin-readable cross-user policy.
- Encrypted column never selected by client code; UI sees only `last4`.
- Decryption happens only inside server handlers, after `requireSupabaseAuth`, for the calling user's own row.

Reply "apply" to build it.