import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Simulated Meta (Facebook + Instagram) connect.
 *
 * Real OAuth scaffolding lives at /api/public/oauth/meta/start +
 * /api/public/oauth/meta/callback. Those routes activate automatically
 * when META_APP_ID + META_APP_SECRET secrets are present. Until then
 * (or for design / preview testing) this function inserts mock
 * social_accounts rows so the UI flows can be exercised end-to-end.
 */
export const connectMetaSimulated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const expires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const rows = [
      {
        user_id: userId,
        platform: "facebook" as const,
        external_account_id: `sim-fb-page-${userId.slice(0, 8)}`,
        display_name: "Demo Realty Page (Simulated)",
        avatar_url: null,
        access_token_enc: "SIMULATED",
        refresh_token_enc: null,
        expires_at: expires,
        scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
        status: "active" as const,
        metadata: { simulated: true, page_id: `sim-fb-page-${userId.slice(0, 8)}` },
      },
      {
        user_id: userId,
        platform: "instagram" as const,
        external_account_id: `sim-ig-${userId.slice(0, 8)}`,
        display_name: "@demo_realty (Simulated)",
        avatar_url: null,
        access_token_enc: "SIMULATED",
        refresh_token_enc: null,
        expires_at: expires,
        scopes: ["instagram_basic", "instagram_content_publish"],
        status: "active" as const,
        metadata: { simulated: true, ig_user_id: `sim-ig-${userId.slice(0, 8)}` },
      },
    ];

    const { error } = await supabase
      .from("social_accounts")
      .upsert(rows, { onConflict: "user_id,platform,external_account_id" as never });

    // upsert may not have the unique index — fall back to delete+insert per platform
    if (error) {
      await supabase
        .from("social_accounts")
        .delete()
        .eq("user_id", userId)
        .in("platform", ["facebook", "instagram"]);
      const { error: insErr } = await supabase.from("social_accounts").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true, simulated: true, connected: ["facebook", "instagram"] };
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
