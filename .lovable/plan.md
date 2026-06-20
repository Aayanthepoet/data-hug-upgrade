
# PropAI — Port + Full Backend

Your `index.html` is a landing page that references 7 product modules (Owner Search, Skip Trace, Lead Scoring, Outreach, Vision Studio, Video Studio, Auction Engine) plus a PropAI Agent. Each module is a substantial product on its own. We'll build in clear phases so you have working software at every step instead of waiting months for one big drop.

## Phase 1 — Foundation (this turn)
- Enable Lovable Cloud (Postgres + Auth + Storage + AI Gateway)
- Port the landing page from HTML/CSS into React/TanStack routes
  - `/` (landing), `/features`, `/pricing`, `/auth/login`, `/auth/register`
  - Keep your exact Sora + DM Serif + JetBrains Mono typography, cyan accent, dark grid aesthetic
- Set up the design system in `styles.css` from your existing CSS variables
- Email/password + Google auth, `profiles` table, `user_roles` (admin/user)
- Lead capture form (CTA buttons) → `leads` table

## Phase 2 — Core data + dashboard
- Authenticated `/app` shell with sidebar nav for the 7 modules
- Database schema: `properties`, `owners`, `contacts`, `lead_lists`, `campaigns`, `outreach_messages`, `auctions`, `bids`, `media_assets`, `videos`
- RLS so each user only sees their own data
- Empty-state UIs for each module

## Phase 3 — AI-powered modules (one at a time, in priority order you choose)
Each uses Lovable AI Gateway (Gemini) via server functions:
1. **Outreach Engine** — generate personalized seller letters from owner context
2. **Lead Scoring** — 0–100 motivation score from equity/distress signals
3. **PropAI Agent** — chat assistant with account context
4. **Vision Studio** — property image redesign (AI image gen)
5. **Video Studio** — script + voiceover + assembly (requires 3rd-party for full video render)

## Phase 4 — External data integrations (require paid APIs you'd provide)
- **Owner Search / Property Intelligence** — needs a property data provider (ATTOM, Estated, Regrid, or PropMix). Pick one; I'll wire it.
- **Skip Tracing / Contact Resolver** — needs BatchSkipTracing, Skip Genie, or similar. Pick one.
- **Auction Engine** — real-time bidding (Lovable Cloud realtime channels)

## What you need to decide
1. Approve the phase plan
2. After Phase 1 ships, tell me which Phase 3 module to build first
3. For Phase 4, which property-data and skip-trace providers you have (or want) accounts with

## Technical notes
- Stack: TanStack Start (React 19) + Lovable Cloud (Postgres/Auth/Storage) + Lovable AI Gateway
- Roles stored in separate `user_roles` table with `has_role()` security-definer function (not on profiles)
- All AI calls happen server-side via `createServerFn` — no API keys in the browser
- Your existing HTML stays as a reference; we won't keep the PHP/static structure

Phase 1 is roughly one full turn of work. Reply "go" to start, or tell me to adjust scope.
