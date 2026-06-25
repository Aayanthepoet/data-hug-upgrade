import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAttomStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const key = process.env.ATTOM_API_KEY ?? "";
    const configured = key.trim().length > 0;

    let live = false;
    let error: string | null = null;
    if (configured) {
      try {
        const res = await fetch(
          "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot?postalcode=10001&pagesize=1",
          { headers: { apikey: key, Accept: "application/json" } },
        );
        if (res.ok) live = true;
        else error = `ATTOM responded ${res.status}`;
      } catch (e) {
        error = e instanceof Error ? e.message : "Network error";
      }
    }

    return {
      configured,
      live,
      error,
      isAdmin: !!isAdmin,
      maskedKey: configured ? `••••${key.slice(-4)}` : null,
    };
  });
