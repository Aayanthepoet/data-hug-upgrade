## AI Voice Caller — Multi-Company Sales

A single Twilio number serves all 9 companies. Inbound: caller picks a company (press 1–9), AI agent qualifies as a sales rep for that company. Outbound: pick a lead + company → AI dials and runs the sales script.

### Architecture

```text
Caller / Lead phone
        │
        ▼
   Twilio number ── inbound webhook ──▶  /api/public/voice/incoming        (TwiML: IVR menu 1–9)
        │                                       │
        │                            (DTMF) ──▶ /api/public/voice/route    (loads company, starts AI loop)
        │                                       │
        │            ◀──── <Gather> turn ────── /api/public/voice/turn    (transcript → Lovable AI → <Say> reply)
        │                                       │
        ▼                                       ▼
   Outbound trigger  ──▶  /app outbound action  ──▶  Twilio REST API (create call) ──▶ /api/public/voice/outbound  (same turn loop)
```

All webhooks live under `/api/public/voice/*` (Lovable's auth-bypass prefix for external callers). Each handler verifies Twilio's `X-Twilio-Signature` HMAC before responding.

### What we'll build this turn

**1. Twilio connector**
- Link the Twilio connector. You'll choose the connection holding your account credentials + the number.

**2. Database (one migration, with GRANTs + RLS)**
- `companies` — id, owner user_id, name, dtmf_digit (1–9), greeting, sales_script (system prompt), voice ("alice"/"man"/"woman"), is_active. Unique (user_id, dtmf_digit).
- `call_sessions` — id, user_id, company_id, lead_id (nullable), twilio_call_sid, direction (inbound/outbound), from_number, to_number, status (ringing/in_progress/completed/failed), started_at, ended_at, duration_seconds, outcome (qualified/not_qualified/voicemail/no_answer/callback_requested), summary.
- `call_turns` — id, session_id, role (user/assistant/system), text, created_at. Stores the running conversation for AI context.

**3. Public webhook routes** (`src/routes/api/public/voice/*.ts`)
- `incoming.ts` — `<Say>` greeting + `<Gather numDigits=1>` for company pick. Validates Twilio signature.
- `route.ts` — receives DTMF, creates `call_sessions` row, returns TwiML `<Gather input="speech">` prompting the first question.
- `turn.ts` — receives caller's transcribed speech, appends to `call_turns`, calls Lovable AI (`google/gemini-3-flash-preview`) with the company's `sales_script` + history, persists reply, returns TwiML `<Say>` + next `<Gather>`. Detects natural endings ("not interested", goodbye) and ends the call.
- `status.ts` — Twilio call status callback; updates `status`, `ended_at`, `duration_seconds`.

**4. Outbound** (`src/lib/voice/outbound.functions.ts`)
- `startOutboundCall({ company_id, lead_id, to_number })` — server fn. Verifies user owns the company + lead, then POSTs to Twilio `Calls.json` via the connector gateway with `Url` pointing to `/api/public/voice/outbound` (same turn loop, but the AI opens with the company's outbound script).

**5. UI**
- **`/app/companies`** — list, create, edit the 9 companies (name, DTMF digit, greeting, sales script, voice). Includes inline copy of your Twilio number.
- **`/app/calls`** — call history table (company, direction, from/to, duration, outcome, summary) with a drawer showing the full turn-by-turn transcript.
- **Owners page** — "Call with AI" button per owner phone → opens a small dialog to pick which company script to use, then triggers `startOutboundCall`.

### Voice stack choice

Going with **Twilio `<Gather>` + Lovable AI + Twilio TTS** (turn-based, ~1–2s latency). This works on Lovable's serverless runtime. Real-time streaming (Twilio Media Streams + OpenAI Realtime) would need a long-lived WebSocket server hosted elsewhere — out of scope for this build.

### Security

- Every `/api/public/voice/*` handler validates Twilio's HMAC signature against `TWILIO_AUTH_TOKEN` before touching the DB.
- DB writes from webhooks go through `supabaseAdmin` (loaded inside the handler) since the caller has no Supabase session.
- `companies` and `call_sessions` are user-scoped via RLS for the app UI.
- Outbound server fn requires `requireSupabaseAuth` and verifies company/lead ownership before placing the call.

### Costs to know

- Twilio: ~$0.0085/min inbound, ~$0.014/min outbound (US), plus ~$1.15/mo per number.
- Lovable AI: per-request, deducted from workspace credits.
- Twilio TTS (Polly Neural voices) and speech recognition billed per use.

### What's NOT in this turn

- Sub-second streaming voice (would need external WebSocket infra).
- Call recording + post-call transcription (Twilio does this server-side; easy follow-up).
- Voicemail detection / answering-machine handling beyond Twilio's built-in `MachineDetection`.
- SMS follow-ups after a call (easy follow-up using the same Twilio connection).

Approve to proceed and I'll start with the Twilio connector + migration.
