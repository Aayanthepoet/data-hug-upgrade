import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta OAuth start endpoint — scaffolded.
 *
 * When META_APP_ID + META_APP_SECRET secrets are configured, this will:
 *  1. Generate a CSRF state token (stored in a short-lived cookie)
 *  2. Redirect the user to https://www.facebook.com/v21.0/dialog/oauth
 *     with the configured redirect_uri, scopes, and state.
 *
 * Without those secrets, it returns a small page that points the user
 * back to /app/social and explains how to enable real OAuth. The UI
 * uses the "Connect (Simulated)" button in the meantime.
 */
export const Route = createFileRoute("/api/public/oauth/meta/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        const url = new URL(request.url);
        const origin = url.origin;

        if (!appId || !appSecret) {
          return new Response(
            renderHtml({
              title: "Meta OAuth not configured",
              body: `
                <h1>Meta OAuth is in simulation mode</h1>
                <p>No <code>META_APP_ID</code> / <code>META_APP_SECRET</code> are configured for this project.</p>
                <p>To enable real Facebook + Instagram posting, create a Meta developer app and add both secrets — then this endpoint will perform the real OAuth handshake.</p>
                <p><strong>Redirect URI to register in your Meta app:</strong></p>
                <pre>${origin}/api/public/oauth/meta/callback</pre>
                <p><a href="/app/social">← Back to Social Amplifier</a></p>
              `,
            }),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        // Real OAuth flow (activated once secrets exist)
        const state = crypto.randomUUID();
        const redirectUri = `${origin}/api/public/oauth/meta/callback`;
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

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
            "Set-Cookie": `meta_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});

function renderHtml({ title, body }: { title: string; body: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.6;color:#222}pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto;font-size:13px}code{background:#f4f4f5;padding:2px 6px;border-radius:4px}a{color:#0ea5e9}</style>
</head><body>${body}</body></html>`;
}
