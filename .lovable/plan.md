# PropAI Social Amplifier — SEO + Auto-Post System

## Goal

Each agent picks a property, AI writes platform-tailored captions, and the post is:
1. **Published as a public, SEO-optimized landing page on your domain** (the thing Google actually ranks).
2. **Cross-posted to the agent's connected social accounts** (Facebook Page, Instagram, LinkedIn, X, YouTube Shorts, TikTok), either now or on a schedule.

Public pages are the SEO moat. Social drives traffic back to them.

---

## Important reality check on platforms

Each platform has different costs/approvals. None of this is a Lovable limitation — it's how the platforms work:

| Platform | What's needed | Notes |
|---|---|---|
| Facebook Page + Instagram Business | Meta App + per-agent OAuth ("Facebook Login for Business"); Page + IG Business account linked | Free. App Review needed before non-test users can post. |
| LinkedIn (personal + company pages) | LinkedIn app with `w_member_social` + `w_organization_social` scopes; LinkedIn Partner Program approval | Free, but `w_organization_social` requires app review. |
| X / Twitter | X API **Basic tier ($200/mo)** for posting | No way around the paid tier. |
| YouTube Shorts | Google OAuth + YouTube Data API v3 quota | Free; daily upload quota applies. |
| TikTok | TikTok for Developers + Content Posting API approval | Approval takes weeks; until then only sandbox accounts can post. |

**MVP recommendation:** ship the SEO landing pages + Facebook/Instagram + LinkedIn first (highest ROI, free, fastest approval). Add X / YouTube / TikTok behind feature flags once you have Meta + LinkedIn flowing. I'll structure the system so adding a platform later is just one adapter file.

---

## Architecture

```text
                       ┌────────────────────────────┐
                       │  Agent picks a property    │
                       └──────────────┬─────────────┘
                                      │
                       AI generates per-platform variants
                                      │
              ┌───────────────────────┼──────────────────────────┐
              ▼                       ▼                          ▼
   public landing page         social_posts queue        media (image/video)
   /agents/{slug}/p/{id}    (status, scheduled_at,     stored in Supabase
   indexable, JSON-LD,      per-platform payload)        Storage bucket
   sitemap, og:tags
                                      │
                                      ▼
                         pg_cron tick (every minute)
                          → POST /api/public/hooks/publish-social
                                      │
                ┌─────────────────────┼──────────────────────┐
                ▼                     ▼                      ▼
           Meta Graph API      LinkedIn UGC API        (X / YT / TikTok)
       per-agent OAuth token   per-agent OAuth token       adapters
                │                     │                      │
                ▼                     ▼                      ▼
                       update social_post_targets row
                     (status, remote_url, error_message)
```

---

## Database (new tables)

All in `public`, with proper GRANTs and RLS scoped to `auth.uid()` (agent owns their data; admin can read all).

- `social_accounts` — per-agent OAuth tokens per platform. Columns: `id`, `user_id`, `platform`, `external_account_id`, `display_name`, `access_token` (encrypted), `refresh_token`, `expires_at`, `scopes`, `status`, `connected_at`.
- `social_posts` — one logical post. Columns: `id`, `user_id`, `property_id` (FK), `landing_slug` (unique), `headline`, `body_md`, `hero_image_url`, `cta_url`, `status` (`draft`|`scheduled`|`publishing`|`published`|`failed`), `scheduled_at`, `published_at`.
- `social_post_targets` — one row per (post, platform). Columns: `id`, `post_id`, `platform`, `caption`, `hashtags`, `status`, `remote_post_id`, `remote_url`, `attempts`, `last_error`, `posted_at`.
- `social_post_media` — uploaded images/videos per post (already-existing `media_assets` may be reused if compatible).
- Tightened `profiles` with `public_slug` (unique, for landing page URL) and a publish flag.

Trigger: when `social_posts.scheduled_at <= now()` and status is `scheduled`, the cron worker picks it up.

---

## Public agent landing pages (the SEO surface)

New TanStack routes (top-level, **not** under `_authenticated`, fully indexable):

- `/agents/$slug` — agent index: name, headshot, bio, list of their published posts. Loader uses server publishable client + `TO anon` SELECT policy.
- `/agents/$slug/p/$postSlug` — individual post page. Hero image, headline, AI-written body, property details, contact CTA.
  - `head()`: unique title, meta description, canonical, `og:title/description/image`, `twitter:card`, JSON-LD `RealEstateListing` + `Person` (the agent) + `BreadcrumbList`.
  - Loader hydrates from a public `getPublicPost({ slug })` server fn.
- `public/sitemap.xml` route updated to list all published agent + post pages.
- `robots.txt` allows crawling these paths.

This is what Google ranks. Cross-posts on social all link back to `/agents/$slug/p/$postSlug?utm_source=…`.

---

## Server functions & routes

Authenticated (`requireSupabaseAuth`):
- `generatePostFromProperty({ propertyId, platforms })` — calls Lovable AI (`google/gemini-3-flash-preview`) with a prompt template per platform; returns draft `social_posts` + `social_post_targets` for review.
- `savePostDraft / publishNow / schedulePost / cancelPost`.
- `listSocialAccounts / disconnectSocialAccount`.
- `startOAuthConnect({ platform })` → returns provider authorize URL with state (signed JWT containing `user_id` + `platform`).

OAuth callbacks (public routes under `/api/public/oauth/`, one per platform):
- `/api/public/oauth/meta/callback`
- `/api/public/oauth/linkedin/callback`
- (later: `x`, `google`, `tiktok`)

Each verifies `state`, exchanges code for tokens, encrypts and upserts into `social_accounts`.

Public reads:
- `getPublicAgent({ slug })`, `getPublicPost({ slug })` — server publishable client, no bearer needed.

Cron worker:
- Route: `POST /api/public/hooks/publish-social` — apikey-authed.
- Picks up `social_post_targets` where parent post is `scheduled` and `scheduled_at <= now()` (or `status='publishing'` stuck > 5 min).
- For each target, calls the platform adapter; updates row with success/failure; backs off retries (max 3).
- pg_cron schedules it every minute via `pg_net`.

---

## Platform adapters (`src/lib/social/adapters/`)

One file per platform implementing a common interface:

```ts
interface SocialAdapter {
  platform: Platform;
  publish(args: { account: SocialAccount; target: PostTarget; mediaUrls: string[] }):
    Promise<{ remoteId: string; remoteUrl: string }>;
  refreshTokenIfNeeded(account: SocialAccount): Promise<SocialAccount>;
}
```

Phase 1 ships `meta.ts` (Facebook + Instagram) and `linkedin.ts`. Phase 2 stubs `x.ts`, `youtube.ts`, `tiktok.ts` returning "not enabled" until you complete platform approval.

---

## Secrets needed (I'll request these only after you confirm the plan)

For each platform you want enabled in Phase 1:
- Meta: `META_APP_ID`, `META_APP_SECRET`
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- Plus `OAUTH_STATE_SECRET` (auto-generated) for signing OAuth state, and `TOKEN_ENCRYPTION_KEY` (auto-generated) for at-rest token encryption.

I'll walk you through where to create each provider app and which redirect URIs to whitelist.

---

## Pages in the app (authenticated)

- `/app/social` — overview: connected accounts, recent posts, calendar view.
- `/app/social/compose?propertyId=…` — pick property → AI generates per-platform drafts → edit → schedule/publish.
- `/app/social/accounts` — connect/disconnect Meta, LinkedIn, etc.
- `/app/social/posts/$id` — post detail with per-platform status + retry button.
- `/app/settings/public-profile` — agent sets `public_slug`, headshot, bio, contact info that shows on `/agents/$slug`.

---

## Build order (so you see value fast)

1. **DB schema + RLS + GRANTs** (1 migration).
2. **Public agent + post landing pages** + sitemap + JSON-LD. Seed with a sample post so SEO scan sees real content immediately.
3. **Compose UI + AI generation** from a property (no posting yet — just creates `social_posts` and renders the landing page).
4. **Meta OAuth + adapter + cron worker.** Verify with a Meta test user.
5. **LinkedIn OAuth + adapter.**
6. Scheduling calendar + retry/error UI.
7. (Later, behind flags) X, YouTube Shorts, TikTok adapters.

---

## What I need from you to start

1. **Confirm Phase 1 scope** (landing pages + Meta + LinkedIn first; X/YT/TikTok stubbed).
2. **Public profile fields** for agents: just name + headshot + bio + phone + email, or anything else (license #, brokerage, service areas)?
3. **Domain for landing pages.** I'll build with relative URLs so it works on both the preview and `propai.ainetworkagency.com` later — confirm that subdomain plan still stands.
4. **Meta + LinkedIn developer apps** — I'll guide you through creating them when we hit step 4/5; you don't need them yet.

Reply with any changes and I'll start at step 1.
