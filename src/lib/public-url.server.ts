// The public base URL of this deployment, in one place.
//
// Four call sites needed "where does the outside world reach us", and each had
// its own hardcoded fallback to the same Lovable preview host:
//
//   social-oauth.functions.ts   OAuth redirect_uri sent to Meta
//   contracts.functions.ts      webhook_url handed to SignWell
//   distress/sync.server.ts     self-call to our own sync-distressed-one hook
//   notifications.functions.ts  link seeded into the notify vault
//
// Those fallbacks were invisible failures waiting to happen: on Vercel they do
// not error, they just quietly point a third party at a Lovable URL that is not
// this app. The OAuth one was worse — it tested VITE_SUPABASE_URL and then
// returned the hardcoded host regardless of the result, so the condition never
// meant anything.
//
// NOTIFY_PUBLIC_URL is reused rather than replaced with a new variable: two of
// the four already read it, so this is the existing convention rather than a
// new one to remember. Set it to the deployment's own origin
// (e.g. https://propai.ainetworkagency.com).

/** Absolute origin for this deployment, no trailing slash.
 *
 *  Falls back to the dev server origin when NOTIFY_PUBLIC_URL is unset, which
 *  is right locally and loudly wrong in production — an OAuth redirect or
 *  webhook pointed at localhost fails visibly at the provider, where the old
 *  Lovable fallback failed silently by succeeding against the wrong app. */
export function publicBaseUrl(): string {
  const fromEnv = process.env.NOTIFY_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:8080";
}
