// Vision Studio server functions: generate, list, delete, and sign URLs for
// rendered images. Every render is persisted to `media_assets` with full
// status lifecycle (queued → rendering → ready/failed) so the UI shows a
// history and an audit trail per user / per property.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STYLES = ["modern", "scandinavian", "industrial", "farmhouse", "mid-century", "coastal"] as const;
const RESOLUTIONS = ["hd", "2k", "4k"] as const;

const GenerateInput = z.object({
  prompt: z.string().min(4).max(2000),
  style: z.enum(STYLES).default("modern"),
  resolution: z.enum(RESOLUTIONS).default("hd"),
  property_id: z.string().uuid().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  source_image_url: z.string().url().nullable().optional(),
});

const BUCKET = "vision-renders";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const generateRedesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Pick provider — real if API key present, otherwise mock — and
    //    validate the requested resolution BEFORE we queue a render row,
    //    so unsupported tiers (e.g. 4K on gpt-image-2) surface a clean
    //    error to the UI instead of a half-written audit row.
    const key = process.env.LOVABLE_API_KEY;
    const { mockVisionProvider } = await import("./mock-provider.server");
    const { createLovableVisionProvider } = await import("./lovable-provider.server");
    const { RESOLUTION_LABELS } = await import("./provider");
    const provider = key ? createLovableVisionProvider(key) : mockVisionProvider;

    if (!provider.supportedResolutions.includes(data.resolution)) {
      const supportedLabel = provider.supportedResolutions
        .map((r) => RESOLUTION_LABELS[r])
        .join(", ");
      throw new Error(
        `${RESOLUTION_LABELS[data.resolution]} is not available on the current renderer (${provider.name}). Supported: ${supportedLabel}.`,
      );
    }

    // 2. Queue a row up-front so a crash still leaves an audit record.
    const { data: row, error: insErr } = await supabase
      .from("media_assets")
      .insert({
        user_id: userId,
        asset_type: "image",
        url: "",
        prompt: data.prompt,
        style: data.style,
        property_id: data.property_id ?? null,
        owner_id: data.owner_id ?? null,
        source_image_url: data.source_image_url ?? null,
        status: "queued",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const renderId = row.id as string;

    await supabase
      .from("media_assets")
      .update({ status: "rendering", provider: provider.name })
      .eq("id", renderId);

    // 3. Render.
    let imageBase64: string;
    try {
      const out = await provider.render({
        prompt: data.prompt,
        style: data.style,
        resolution: data.resolution,
        sourceImageUrl: data.source_image_url ?? null,
      });
      imageBase64 = out.imageBase64;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Render failed";
      await supabase
        .from("media_assets")
        .update({ status: "failed", error: msg })
        .eq("id", renderId);
      throw new Error(msg);
    }

    // 4. Upload PNG to private bucket under <userId>/<renderId>.png so the
    //    bucket RLS (user-prefixed) lets the owner — and only the owner —
    //    read/delete it later via signed URLs.
    const bytes = base64ToBytes(imageBase64);
    const storagePath = `${userId}/${renderId}.png`;

    // Service-role upload bypasses the user's storage RLS but still writes
    // the row into the user's prefix so signed URLs work consistently.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: "image/png", upsert: true });
    if (upErr) {
      await supabase
        .from("media_assets")
        .update({ status: "failed", error: `Upload failed: ${upErr.message}` })
        .eq("id", renderId);
      throw new Error(upErr.message);
    }

    const { error: finErr } = await supabase
      .from("media_assets")
      .update({
        status: "ready",
        url: storagePath, // we keep the storage path as the canonical URL
        storage_path: storagePath,
      })
      .eq("id", renderId);
    if (finErr) throw new Error(finErr.message);

    // 5. Return a short-lived signed URL so the client can show the image
    //    immediately without round-tripping through listRenders.
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (signErr) throw new Error(signErr.message);

    return {
      id: renderId,
      status: "ready" as const,
      provider: provider.name,
      url: signed.signedUrl,
      storage_path: storagePath,
    };
  });

const ListInput = z
  .object({
    property_id: z.string().uuid().nullable().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .default({});

export const listRenders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let q = supabase
      .from("media_assets")
      .select(
        "id, prompt, style, status, error, provider, property_id, owner_id, storage_path, created_at, properties(address, city, state)",
      )
      .eq("user_id", userId)
      .eq("asset_type", "image")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);

    if (data.property_id) q = q.eq("property_id", data.property_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Sign each ready row's storage path so the client can render thumbnails.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out = await Promise.all(
      (rows ?? []).map(async (r) => {
        let signedUrl: string | null = null;
        if (r.status === "ready" && r.storage_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(r.storage_path, 60 * 60);
          signedUrl = signed?.signedUrl ?? null;
        }
        return { ...r, signed_url: signedUrl };
      }),
    );
    return out;
  });

export const deleteRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Look up & verify ownership (RLS also enforces, but we need the path).
    const { data: row, error: getErr } = await supabase
      .from("media_assets")
      .select("storage_path, user_id")
      .eq("id", data.id)
      .single();
    if (getErr) throw new Error(getErr.message);
    if (row.user_id !== userId) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (row.storage_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
    }
    const { error: delErr } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export const linkRenderToProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        property_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("media_assets")
      .update({ property_id: data.property_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Small picker feed for the UI — recent properties the user has.
export const listPropertiesForRender = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("properties")
      .select("id, address, city, state")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
