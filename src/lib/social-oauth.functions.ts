import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateOAuthState } from "./oauth-state.server";

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

/**
 * Generate the Meta OAuth Authorize URL for the currently authenticated user.
 */
export const getMetaOAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const appId = process.env.META_APP_ID;
    
    if (!appId) {
      throw new Error("META_APP_ID is not configured.");
    }

    // Determine the redirect origin. We default to the preview URL.
    const origin = process.env.VITE_SUPABASE_URL 
      ? `https://id-preview--f060fcf2-0071-41a6-8014-e8dd9520d418.lovable.app`
      : "http://localhost:8080";
      
    const redirectUri = `${origin}/api/public/oauth/meta/callback`;
    const state = generateOAuthState(userId);
    
    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ].join(",");

    const authUrl =
      `https://www.facebook.com/v21.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&scope=${encodeURIComponent(scopes)}`;

    return { url: authUrl };
  });

export const listAvailableMetaAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    // Fall back to simulation if credentials aren't set
    if (!appId || !appSecret) {
      return { simulated: true, pages: MOCK_PAGES };
    }

    // Retrieve the master token from social_accounts
    const { data: accounts, error } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "facebook")
      .like("external_account_id", "meta_master_%")
      .maybeSingle();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!accounts || !accounts.access_token_enc) {
      return { simulated: false, needs_connect: true, pages: [] };
    }

    const userToken = accounts.access_token_enc;

    try {
      // Query Graph API for user's pages and linked Instagram accounts
      const fields = "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}";
      const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=${fields}&access_token=${userToken}`;
      
      const res = await fetch(pagesUrl);
      if (!res.ok) {
        // If the token is invalid or expired, prompt re-connection
        if (res.status === 401 || res.status === 400) {
          return { simulated: false, needs_connect: true, pages: [] };
        }
        const errText = await res.text();
        throw new Error(`Facebook API Error: ${errText}`);
      }

      const body = await res.json() as {
        data: Array<{
          id: string;
          name: string;
          access_token: string;
          picture?: { data?: { url?: string } };
          instagram_business_account?: {
            id: string;
            username: string;
            profile_picture_url?: string;
          };
        }>;
      };

      const pages = body.data.map((p) => ({
        external_id: p.id,
        name: p.name,
        avatar_url: p.picture?.data?.url ?? null,
        access_token: p.access_token,
        linked_instagram: p.instagram_business_account
          ? {
              external_id: p.instagram_business_account.id,
              username: p.instagram_business_account.username,
              avatar_url: p.instagram_business_account.profile_picture_url ?? null,
              access_token: p.access_token, // can publish to IG using the linked Page token
            }
          : null,
      }));

      return { simulated: false, pages };
    } catch (err: any) {
      console.error("Failed to list available Meta accounts:", err);
      return { simulated: false, needs_connect: true, pages: [], error: err.message };
    }
  });

const SelectionSchema = z.object({
  pages: z
    .array(
      z.object({
        external_id: z.string().min(1),
        name: z.string().min(1),
        avatar_url: z.string().url().nullable().optional(),
        access_token: z.string().nullable().optional(),
      }),
    )
    .max(20),
  instagram: z
    .array(
      z.object({
        external_id: z.string().min(1),
        username: z.string().min(1),
        avatar_url: z.string().url().nullable().optional(),
        access_token: z.string().nullable().optional(),
      }),
    )
    .max(20),
});

export const saveMetaAccountSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SelectionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Delete any existing page/IG selections (but KEEP the meta_master user profile!)
    await supabase
      .from("social_accounts")
      .delete()
      .eq("user_id", userId)
      .in("platform", ["facebook", "instagram"])
      .not("external_account_id", "like", "meta_master_%");

    const expires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const rows = [
      ...data.pages.map((p) => ({
        user_id: userId,
        platform: "facebook" as const,
        external_account_id: p.external_id,
        display_name: p.name,
        avatar_url: p.avatar_url ?? null,
        access_token_enc: p.access_token || "SIMULATED",
        refresh_token_enc: null,
        expires_at: expires,
        scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
        status: "active" as const,
        metadata: { page_id: p.external_id, simulated: !p.access_token },
      })),
      ...data.instagram.map((i) => ({
        user_id: userId,
        platform: "instagram" as const,
        external_account_id: i.external_id,
        display_name: i.username,
        avatar_url: i.avatar_url ?? null,
        access_token_enc: i.access_token || "SIMULATED",
        refresh_token_enc: null,
        expires_at: expires,
        scopes: ["instagram_basic", "instagram_content_publish"],
        status: "active" as const,
        metadata: { ig_user_id: i.external_id, simulated: !i.access_token },
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
