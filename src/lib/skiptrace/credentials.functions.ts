// Per-user skip-trace provider credentials. Bring-your-own-key.
// Keys are encrypted at rest with the same AES-256-GCM helper used for
// social tokens. RLS ensures only the owning user can ever see their row.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptToken } from "@/lib/social-token-crypto.server";
import {
  PROVIDER_AVAILABLE,
  PROVIDER_LABELS,
  buildAdapter,
  type SkiptraceProviderId,
} from "./adapters";

const ProviderEnum = z.enum(["batchdata", "idi", "tlo", "reiskip", "whitepages"]);

export const listMySkiptraceCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_skiptrace_credentials")
      .select("id, provider, label, api_key_last4, is_active, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      credentials: data ?? [],
      providerLabels: PROVIDER_LABELS,
      providerAvailable: PROVIDER_AVAILABLE,
    };
  });

const UpsertInput = z.object({
  provider: ProviderEnum,
  apiKey: z.string().min(8, "API key looks too short").max(512),
  label: z.string().trim().max(80).optional().nullable(),
});

export const upsertSkiptraceCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!PROVIDER_AVAILABLE[data.provider as SkiptraceProviderId]) {
      throw new Error(`${PROVIDER_LABELS[data.provider as SkiptraceProviderId]} support is not yet available.`);
    }
    const apiKey = data.apiKey.trim();
    const encrypted = encryptToken(apiKey);
    const last4 = apiKey.slice(-4);

    const { error } = await context.supabase
      .from("user_skiptrace_credentials")
      .upsert(
        {
          user_id: context.userId,
          provider: data.provider,
          api_key_encrypted: encrypted,
          api_key_last4: last4,
          label: data.label ?? null,
          is_active: true,
        } as never,
        { onConflict: "user_id,provider" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSkiptraceCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_skiptrace_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testSkiptraceCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider: ProviderEnum }).parse(d))
  .handler(async ({ data, context }) => {
    // Pull the user's own stored, encrypted key (RLS scoped).
    const { data: row, error } = await context.supabase
      .from("user_skiptrace_credentials")
      .select("api_key_encrypted, provider")
      .eq("user_id", context.userId)
      .eq("provider", data.provider)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, error: "No credential stored for this provider." };

    const { decryptToken } = await import("@/lib/social-token-crypto.server");
    const apiKey = decryptToken((row as { api_key_encrypted: string }).api_key_encrypted);
    if (!apiKey) return { ok: false, error: "Stored key could not be decrypted." };

    const adapter = buildAdapter(data.provider as SkiptraceProviderId, apiKey);
    if (!adapter) return { ok: false, error: "Adapter not available." };

    // Use the adapter's own test path when present (no skip-trace credit).
    const maybeTest = (adapter as { testCredential?: () => Promise<{ ok: boolean; error?: string }> }).testCredential;
    if (typeof maybeTest === "function") {
      try {
        const r = await maybeTest.call(adapter);
        return r;
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Test failed" };
      }
    }
    return { ok: true, error: undefined };
  });
