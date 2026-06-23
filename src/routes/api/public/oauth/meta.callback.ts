import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta OAuth callback — scaffolded.
 *
 * When META_APP_ID + META_APP_SECRET are present, this will:
 *  1. Verify the `state` cookie matches the returned `state` param
 *  2. Exchange `code` for a short-lived user access token
 *  3. Exchange that for a long-lived (~60 day) token
 *  4. Fetch /me/accounts (Pages) + connected IG business accounts
 *  5. Upsert one row per Page / IG account in `social_accounts`
 *  6. Redirect to /app/social?connected=meta
 *
 * Until secrets exist, this endpoint just bounces back with a notice.
 */
export const Route = createFileRoute("/api/public/oauth/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");

        if (error) {
          return new Response(null, {
            status: 302,
            headers: { Location: `/app/social?meta_error=${encodeURIComponent(error)}` },
          });
        }

        if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
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

        // Real token exchange + account upsert will be implemented when
        // secrets are present. For now, bounce back with a notice.
        return new Response(null, {
          status: 302,
          headers: { Location: "/app/social?meta_error=handler_not_implemented" },
        });
      },
    },
  },
});
