import { createFileRoute } from "@tanstack/react-router";

/**
 * X (Twitter) OAuth 2.0 start endpoint — scaffolded.
 *
 * When X_CLIENT_ID + X_CLIENT_SECRET secrets are configured, this redirects
 * the user to X's OAuth 2.0 authorization screen with PKCE. Without those
 * secrets it returns an info page with the redirect URI to register in the
 * X Developer Portal.
 */
export const Route = createFileRoute("/api/public/oauth/x/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.X_CLIENT_ID;
        const clientSecret = process.env.X_CLIENT_SECRET;
        const url = new URL(request.url);
        const origin = url.origin;
        const redirectUri = `${origin}/api/public/oauth/x/callback`;

        if (!clientId || !clientSecret) {
          return new Response(
            renderHtml({
              title: "X OAuth not configured",
              body: `
                <h1>X / Twitter OAuth is not configured</h1>
                <p>Add <code>X_CLIENT_ID</code> and <code>X_CLIENT_SECRET</code> secrets from your X Developer App (User authentication settings → OAuth 2.0).</p>
                <p><strong>Redirect URI to register in the X Developer Portal:</strong></p>
                <pre>${redirectUri}</pre>
                <p>Required scopes: <code>tweet.read tweet.write users.read offline.access</code></p>
                <p><a href="/app/social">← Back to Social Amplifier</a></p>
              `,
            }),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        // PKCE: generate a code verifier + S256 challenge
        const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = await sha256Base64Url(verifier);
        const state = crypto.randomUUID();
        const scopes = "tweet.read tweet.write users.read offline.access";

        const authUrl =
          `https://twitter.com/i/oauth2/authorize` +
          `?response_type=code` +
          `&client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scopes)}` +
          `&state=${state}` +
          `&code_challenge=${challenge}` +
          `&code_challenge_method=S256`;

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
            "Set-Cookie": [
              `x_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
              `x_oauth_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
            ].join(", "),
          },
        });
      },
    },
  },
});

function base64UrlEncode(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64UrlEncode(new Uint8Array(buf));
}

function renderHtml({ title, body }: { title: string; body: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.6;color:#222}pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto;font-size:13px}code{background:#f4f4f5;padding:2px 6px;border-radius:4px}a{color:#0ea5e9}</style>
</head><body>${body}</body></html>`;
}
