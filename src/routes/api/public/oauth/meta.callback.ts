import { createFileRoute } from "@tanstack/react-router";
import { verifyOAuthState } from "@/lib/oauth-state.server";
import { encryptToken } from "@/lib/social-token-crypto.server";


export const Route = createFileRoute("/api/public/oauth/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (error) {
          return new Response(null, {
            status: 302,
            headers: { Location: `/app/social?meta_error=${encodeURIComponent(error)}` },
          });
        }

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;

        if (!appId || !appSecret) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/app/social?meta_error=not_configured" },
          });
        }

        if (!code) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/app/social?meta_error=missing_code" },
          });
        }

        if (!state) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/app/social?meta_error=missing_state" },
          });
        }

        // Verify the state parameter to extract the authenticated user's ID
        const userId = verifyOAuthState(state);
        if (!userId) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/app/social?meta_error=invalid_state" },
          });
        }

        try {
          // 1. Exchange authorization code for short-lived user access token
          const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token` +
            `?client_id=${encodeURIComponent(appId)}` +
            `&redirect_uri=${encodeURIComponent(`${url.origin}/api/public/oauth/meta/callback`)}` +
            `&client_secret=${encodeURIComponent(appSecret)}` +
            `&code=${encodeURIComponent(code)}`;

          const tokenRes = await fetch(tokenUrl);
          if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            throw new Error(`Failed to exchange code: ${errBody}`);
          }
          const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };
          const shortLivedToken = tokenData.access_token;

          // 2. Exchange short-lived token for long-lived user access token
          const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token` +
            `?grant_type=fb_exchange_token` +
            `&client_id=${encodeURIComponent(appId)}` +
            `&client_secret=${encodeURIComponent(appSecret)}` +
            `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;

          const llRes = await fetch(longLivedUrl);
          if (!llRes.ok) {
            throw new Error("Failed to exchange for long-lived token");
          }
          const llData = await llRes.json() as { access_token: string; expires_in?: number };
          const longLivedToken = llData.access_token;

          // Calculate expiry (default 60 days)
          const expiresIn = llData.expires_in || 60 * 24 * 60 * 60;
          const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

          // 3. Fetch user's Meta profile to get their name
          const profileRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=name,id&access_token=${longLivedToken}`);
          let displayName = "Facebook User";
          let fbUserId = "unknown";
          if (profileRes.ok) {
            const profileData = await profileRes.json() as { name: string; id: string };
            displayName = profileData.name;
            fbUserId = profileData.id;
          }

          // 4. Save the long-lived master User Access Token in social_accounts
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          
          // Delete any existing master connection first to prevent duplicates
          await supabaseAdmin
            .from("social_accounts")
            .delete()
            .eq("user_id", userId)
            .eq("platform", "facebook")
            .eq("external_account_id", `meta_master_${fbUserId}`);

          const { error: insertErr } = await supabaseAdmin
            .from("social_accounts")
            .insert({
              user_id: userId,
              platform: "facebook",
              external_account_id: `meta_master_${fbUserId}`,
              display_name: `${displayName} (Connected Profile)`,
              access_token_enc: encryptToken(longLivedToken),
              expires_at: expiresAt,
              scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish"],
              status: "active",
              metadata: { is_master: true, fb_user_id: fbUserId }
            });

          if (insertErr) {
            throw new Error(`Failed to save account: ${insertErr.message}`);
          }

          return new Response(null, {
            status: 302,
            headers: { Location: "/app/social?connected=meta" },
          });
        } catch (err: any) {
          console.error("Meta OAuth error:", err);
          return new Response(null, {
            status: 302,
            headers: { Location: `/app/social?meta_error=${encodeURIComponent(err.message || "token_exchange_failed")}` },
          });
        }
      },
    },
  },
});
