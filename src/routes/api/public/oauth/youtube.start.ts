import { createFileRoute } from "@tanstack/react-router";

/**
 * YouTube (Google) OAuth start endpoint — scaffolded.
 *
 * When GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET secrets are configured, this
 * redirects the user to Google's consent screen with the YouTube scope.
 * Without those secrets it returns an info page with the redirect URI to
 * register in Google Cloud Console.
 */
export const Route = createFileRoute("/api/public/oauth/youtube/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const url = new URL(request.url);
        const origin = url.origin;
        const redirectUri = `${origin}/api/public/oauth/youtube/callback`;

        if (!clientId || !clientSecret) {
          return new Response(
            renderHtml({
              title: "YouTube OAuth not configured",
              body: `
                <h1>YouTube OAuth is not configured</h1>
                <p>Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> secrets from a Google Cloud OAuth client.</p>
                <p><strong>Redirect URI to register in Google Cloud Console:</strong></p>
                <pre>${redirectUri}</pre>
                <p>Enable the YouTube Data API v3 on the same project.</p>
                <p><a href="/app/social">← Back to Social Amplifier</a></p>
              `,
            }),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        const state = crypto.randomUUID();
        const scopes = [
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/youtube.upload",
        ].join(" ");

        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth` +
          `?client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code` +
          `&access_type=offline` +
          `&prompt=consent` +
          `&state=${state}` +
          `&scope=${encodeURIComponent(scopes)}`;

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
            "Set-Cookie": `youtube_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
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
