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
 * Pure check: given a supabase client (RLS as the user) and the user id,
 * decide whether the caller may use paid features.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function evaluateSubscriptionAccess(supabase: any, userId: string): Promise<GateOutcome> {
  const [subRes, adminRes] = await Promise.all([
    supabase.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);

  const sub = (subRes?.data ?? null) as { status: string | null } | null;
  const isAdmin = Boolean(adminRes?.data);

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
