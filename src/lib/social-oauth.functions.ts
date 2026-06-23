import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Meta (Facebook + Instagram) connect — SIMULATED.
 *
 * Real OAuth scaffolding lives at /api/public/oauth/meta/start +
 * /api/public/oauth/meta/callback. Until META_APP_ID + META_APP_SECRET are
 * set, the UI uses this two-step simulated flow:
 *   1. listAvailableMetaAccounts() — returns a mock list of Pages + IG
 *      Business accounts (the same shape Meta's /me/accounts returns).
 *   2. saveMetaAccountSelection() — inserts the user's chosen subset
 *      into `social_accounts`.
 */

const MOCK_PAGES = [
  {
    external_id: "fb-page-101",
    name: "Demo Realty — Main Page",
    avatar_url: null,
    linked_instagram: {
      external_id: "ig-biz-101",
      username: "@demo_realty",
      avatar_url: null,
    },
  },
  {
    external_id: "fb-page-202",
    name: "Demo Realty — Luxury Listings",
    avatar_url: null,
    linked_instagram: {
      external_id: "ig-biz-202",
      username: "@demo_realty_lux",
      avatar_url: null,
    },
  },
  {
    external_id: "fb-page-303",
    name: "Demo Realty — Rentals",
    avatar_url: null,
    linked_instagram: null,
  },
];

export const listAvailableMetaAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // Real impl would call:
    //   GET https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}
    return { simulated: true, pages: MOCK_PAGES };
  });

const SelectionSchema = z.object({
  pages: z
    .array(
      z.object({
        external_id: z.string().min(1),
        name: z.string().min(1),
        avatar_url: z.string().url().nullable().optional(),
      }),
    )
    .max(20),
  instagram: z
    .array(
      z.object({
        external_id: z.string().min(1),
        username: z.string().min(1),
        avatar_url: z.string().url().nullable().optional(),
      }),
    )
    .max(20),
});

export const saveMetaAccountSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SelectionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Replace any existing simulated meta rows for this user so re-selecting
    // is idempotent.
    await supabase
      .from("social_accounts")
      .delete()
      .eq("user_id", userId)
      .in("platform", ["facebook", "instagram"]);

    const expires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const rows = [
      ...data.pages.map((p) => ({
        user_id: userId,
        platform: "facebook" as const,
        external_account_id: p.external_id,
        display_name: `${p.name} (Simulated)`,
        avatar_url: p.avatar_url ?? null,
        access_token_enc: "SIMULATED",
        refresh_token_enc: null,
        expires_at: expires,
        scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
        status: "active" as const,
        metadata: { simulated: true, page_id: p.external_id },
      })),
      ...data.instagram.map((i) => ({
        user_id: userId,
        platform: "instagram" as const,
        external_account_id: i.external_id,
        display_name: `${i.username} (Simulated)`,
        avatar_url: i.avatar_url ?? null,
        access_token_enc: "SIMULATED",
        refresh_token_enc: null,
        expires_at: expires,
        scopes: ["instagram_basic", "instagram_content_publish"],
        status: "active" as const,
        metadata: { simulated: true, ig_user_id: i.external_id },
      })),
    ];

    if (rows.length) {
      const { error } = await supabase.from("social_accounts").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { ok: true, count: rows.length };
  });

export const disconnectSocialAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ account_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("social_accounts")
      .delete()
      .eq("id", data.account_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
