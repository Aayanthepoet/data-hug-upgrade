import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Inspect-only ATTOM info. Does NOT make any network call to ATTOM,
 * so loading this is free and cannot trigger billable usage.
 */
export const getAttomStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const key = process.env.ATTOM_API_KEY ?? "";
    const configured = key.trim().length > 0;
    const enabled = (process.env.ENABLE_ATTOM ?? "false").toLowerCase() === "true";

    return {
      configured,
      enabled,
      isAdmin: !!isAdmin,
      maskedKey: configured ? `••••${key.slice(-4)}` : null,
    };
  });

/**
 * Explicit, user-initiated probe. Makes exactly one billable ATTOM request.
 * Admin-only and only runs when the feature flag is on, so a stray click
 * cannot fire calls while ATTOM is disabled.
 */
export const testAttomConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const enabled = (process.env.ENABLE_ATTOM ?? "false").toLowerCase() === "true";
    if (!enabled) {
      return {
        live: false,
        error: "ATTOM is disabled (ENABLE_ATTOM=false). No request was made.",
        skipped: true as const,
      };
    }

    const key = process.env.ATTOM_API_KEY ?? "";
    if (!key.trim()) {
      return { live: false, error: "ATTOM_API_KEY not set", skipped: true as const };
    }

    try {
      const res = await fetch(
        "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot?postalcode=10001&pagesize=1",
        { headers: { apikey: key, Accept: "application/json" } },
      );
      return {
        live: res.ok,
        error: res.ok ? null : `ATTOM responded ${res.status}`,
        skipped: false as const,
      };
    } catch (e) {
      return {
        live: false,
        error: e instanceof Error ? e.message : "Network error",
        skipped: false as const,
      };
    }
  });
