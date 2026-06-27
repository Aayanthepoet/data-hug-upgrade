// Server-only helpers that gate paid endpoints by Supabase subscription status.
// Use `requireActiveSubscription` as a server-fn middleware (after requireSupabaseAuth)
// for `createServerFn` endpoints, and `requireActiveSubscriptionApi` for raw HTTP
// routes under /api/* that already validated a bearer token via requireApiAuth.
//
// Status mapping:
//   - no subscription row and not admin     -> 402 Payment Required
//   - row exists but status not active/trial -> 403 Forbidden (sub_inactive)
//   - admins always pass

import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

type GateOutcome =
  | { ok: true; isAdmin: boolean; status: string | null }
  | { ok: false; httpStatus: 402 | 403; code: "no_subscription" | "sub_inactive"; status: string | null };

/**
 * Pure check: given an authenticated supabase client (RLS as the user) and the user id,
 * decide whether the caller may use paid features.
 */
export async function evaluateSubscriptionAccess(
  supabase: {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { status: string | null } | null }> };
      };
    };
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>;
  },
  userId: string,
): Promise<GateOutcome> {
  const [{ data: sub }, { data: isAdmin }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);

  if (isAdmin) return { ok: true, isAdmin: true, status: sub?.status ?? null };

  const status = sub?.status ?? null;
  if (!sub) return { ok: false, httpStatus: 402, code: "no_subscription", status: null };
  if (!ACTIVE_STATUSES.has(status ?? "")) {
    return { ok: false, httpStatus: 403, code: "sub_inactive", status };
  }
  return { ok: true, isAdmin: false, status };
}

/**
 * createServerFn middleware. MUST be chained AFTER requireSupabaseAuth so it
 * sees `context.supabase` and `context.userId`. Throws a Response on block.
 */
export const requireActiveSubscription = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const result = await evaluateSubscriptionAccess(context.supabase, context.userId);
    if (!result.ok) {
      throw new Response(
        JSON.stringify({
          error: result.code,
          message:
            result.code === "no_subscription"
              ? "An active PropAI Pro subscription is required."
              : `Subscription status "${result.status ?? "unknown"}" does not grant access.`,
        }),
        { status: result.httpStatus, headers: { "content-type": "application/json" } },
      );
    }
    return next({ context: { subscriptionStatus: result.status, isAdmin: result.isAdmin } });
  });

/**
 * For raw HTTP routes (server routes under /api/*). Pass the authed user id and
 * a supabase client scoped to that user. Returns null on access or a Response to short-circuit.
 */
export async function requireActiveSubscriptionApi(
  supabase: Parameters<typeof evaluateSubscriptionAccess>[0],
  userId: string,
): Promise<Response | null> {
  const result = await evaluateSubscriptionAccess(supabase, userId);
  if (result.ok) return null;
  return new Response(
    JSON.stringify({
      error: result.code,
      message:
        result.code === "no_subscription"
          ? "An active PropAI Pro subscription is required."
          : `Subscription status "${result.status ?? "unknown"}" does not grant access.`,
    }),
    { status: result.httpStatus, headers: { "content-type": "application/json" } },
  );
}
