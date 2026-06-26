// Shared bearer-token auth for raw HTTP routes under /api/* (not /api/public/*).
// Mirrors what /api/chat does: validates a Supabase access token from the
// Authorization header. Returns the authed user or a Response to short-circuit.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function requireApiAuth(
  request: Request,
): Promise<{ userId: string; email: string | null } | Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token) return new Response("Unauthorized", { status: 401 });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Response("Server misconfigured", { status: 500 });

  const client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return new Response("Unauthorized", { status: 401 });
  return { userId: data.user.id, email: data.user.email ?? null };
}
