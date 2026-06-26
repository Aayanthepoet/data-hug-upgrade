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
  // Either a public URL OR a storage path inside the `vision-renders` bucket
  // (e.g. "<userId>/sources/abc.png"). Paths are signed at read-time so the
  // before/after slider always gets a fresh link.
  source_image_url: z.string().min(1).max(1024).nullable().optional(),
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
    if (!key) {
      // Don't silently render a blank 1x1 PNG when no key is configured —
      // surface a clear error so the UI can prompt the operator.
      throw new Error(
        "Vision Studio is not configured: missing LOVABLE_API_KEY. Enable Lovable Cloud / AI Gateway to render images.",
      );
    }
    const { createLovableVisionProvider } = await import("./lovable-provider.server");
    const { RESOLUTION_LABELS } = await import("./provider");
    const provider = createLovableVisionProvider(key);

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
        "id, prompt, style, status, error, provider, property_id, owner_id, storage_path, source_image_url, created_at, properties(address, city, state)",
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
        // Source photo: stored as a bucket path; sign for the slider.
        // Pre-existing URL strings (http/https) pass through unchanged.
        let sourceSignedUrl: string | null = null;
        if (r.source_image_url) {
          if (/^https?:\/\//i.test(r.source_image_url)) {
            sourceSignedUrl = r.source_image_url;
          } else {
            const { data: signed } = await supabaseAdmin.storage
              .from(BUCKET)
              .createSignedUrl(r.source_image_url, 60 * 60);
            sourceSignedUrl = signed?.signedUrl ?? null;
          }
        }
        return { ...r, signed_url: signedUrl, source_signed_url: sourceSignedUrl };
      }),
    );
    return out;
  });

// Upload a "before" source photo to the private vision-renders bucket under
// the caller's prefix. Returns the storage path the client should pass back
// as `source_image_url` when generating a redesign.
const UploadInput = z.object({
  filename: z.string().min(1).max(120),
  contentType: z.string().min(3).max(80),
  // Base64-encoded bytes, no data: prefix. Client converts the File first.
  base64: z.string().min(4),
  // Optional crop/resize metadata. When the user chose to crop in the
  // dialog, the client sends what they picked so we can save an audit trail
  // alongside the storage path.
  originalFilename: z.string().min(1).max(200).nullable().optional(),
  originalByteSize: z.number().int().nonnegative().nullable().optional(),
  wasCropped: z.boolean().optional(),
  cropAspect: z.string().max(20).nullable().optional(),
  cropMaxEdge: z.number().int().min(64).max(8192).nullable().optional(),
});

export const uploadSourcePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Allowlist mirrors the client validator. The server is the trust
    // boundary — a custom client could skip the client checks entirely.
    const ALLOWED_TYPES = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
    const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
    const MAX_BYTES = 12 * 1024 * 1024;

    const ext = (data.filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!ALLOWED_TYPES.has(data.contentType) && !ALLOWED_EXTS.has(ext)) {
      throw new Error(
        `Unsupported file type "${data.contentType || ext || "unknown"}". Allowed: JPG, PNG, WebP, HEIC.`,
      );
    }

    // base64 inflates by ~4/3; estimate decoded byte length to enforce the
    // real on-disk cap (12 MB) rather than the encoded length.
    const padding = data.base64.endsWith("==") ? 2 : data.base64.endsWith("=") ? 1 : 0;
    const decodedBytes = Math.floor((data.base64.length * 3) / 4) - padding;
    if (decodedBytes <= 0) {
      throw new Error("Upload was empty.");
    }
    if (decodedBytes > MAX_BYTES) {
      const mb = (decodedBytes / (1024 * 1024)).toFixed(1);
      throw new Error(`Image too large: ${mb} MB. Max 12 MB.`);
    }

    const safeExt = ALLOWED_EXTS.has(ext) ? ext : "png";
    const id = crypto.randomUUID();
    const path = `${userId}/sources/${id}.${safeExt}`;
    const bytes = base64ToBytes(data.base64);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    // Record the upload alongside its metadata (filename, size, crop
    // settings) so we have an audit trail per user / per render. We use the
    // RLS-scoped `supabase` client so the row's `user_id` is enforced.
    const { data: photoRow, error: metaErr } = await context.supabase
      .from("vision_source_photos")
      .insert({
        user_id: userId,
        storage_path: path,
        filename: data.filename,
        content_type: data.contentType,
        byte_size: decodedBytes,
        original_filename: data.originalFilename ?? null,
        original_byte_size: data.originalByteSize ?? null,
        was_cropped: data.wasCropped ?? false,
        crop_aspect: data.cropAspect ?? null,
        crop_max_edge: data.cropMaxEdge ?? null,
      })
      .select("id")
      .single();
    if (metaErr) {
      // Roll back the storage object so we don't leave an orphan blob.
      await supabaseAdmin.storage.from(BUCKET).remove([path]);
      throw new Error(`Failed to save photo metadata: ${metaErr.message}`);
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);
    return { id: photoRow.id as string, path, signed_url: signed?.signedUrl ?? null };
  });

// List the caller's source-photo library, newest first, with short-lived
// signed thumbnails so the library page can render previews without exposing
// the bucket. RLS scopes rows to the user — we add a redundant filter for
// belt-and-suspenders.
const ListSourcePhotosInput = z
  .object({
    limit: z.number().int().min(1).max(200).optional(),
  })
  .default({});

export const listSourcePhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListSourcePhotosInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("vision_source_photos")
      .select(
        "id, storage_path, filename, content_type, byte_size, original_filename, original_byte_size, was_cropped, crop_aspect, crop_max_edge, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out = await Promise.all(
      (rows ?? []).map(async (r) => {
        let signedUrl: string | null = null;
        if (r.storage_path) {
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

// Fetch a single source photo by id (with signed URL). Used when reusing a
// library photo as the "before" of a new render — the vision page receives
// just the id via a search param and loads the rest here.
export const getSourcePhoto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("vision_source_photos")
      .select("id, storage_path, filename, content_type, byte_size, user_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (row.user_id !== userId) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let signedUrl: string | null = null;
    if (row.storage_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);
      signedUrl = signed?.signedUrl ?? null;
    }
    return {
      id: row.id as string,
      storage_path: row.storage_path as string,
      filename: row.filename as string,
      signed_url: signedUrl,
    };
  });


// Delete a previously uploaded source photo: removes the storage object and
// its `vision_source_photos` row. Ownership is double-enforced (RLS + check).
export const deleteSourcePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error: getErr } = await supabase
      .from("vision_source_photos")
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
      .from("vision_source_photos")
      .delete()
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
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

// Exposes the active provider's name + supported resolution tiers so the
// UI can disable unsupported options and explain why.
export const getVisionCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env.LOVABLE_API_KEY;
    const { mockVisionProvider } = await import("./mock-provider.server");
    const { createLovableVisionProvider } = await import("./lovable-provider.server");
    const provider = key ? createLovableVisionProvider(key) : mockVisionProvider;
    return {
      provider: provider.name,
      supportedResolutions: [...provider.supportedResolutions],
    };
  });
