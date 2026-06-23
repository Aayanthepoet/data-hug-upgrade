import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,80}[a-z0-9])$/;

const PLATFORMS = ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_BRIEFS: Record<Platform, string> = {
  facebook: "Facebook Page post. 80-200 words. Conversational tone, 1-2 emojis max, end with a soft CTA to view the listing page.",
  instagram: "Instagram caption. 60-150 words. Punchy hook in line 1, line breaks between paragraphs, tasteful emoji, 8-12 niche real-estate hashtags at the end.",
  linkedin: "LinkedIn post. 120-220 words. Professional, data-forward (mention market angle or investment insight), no hashtags spam (3-5 max), end with a question to drive comments.",
  x: "X / Twitter post. <=270 characters total. One sharp hook, 1-2 hashtags, include the listing URL placeholder {{LANDING_URL}}.",
  youtube: "YouTube Shorts description. 80-160 words. Optimized for search: include neighborhood, beds/baths, price hook, 5-8 hashtags at the bottom.",
  tiktok: "TikTok caption. <=150 characters. Hook + 3-5 trending real-estate hashtags. No URLs (TikTok strips them).",
};

const PostVariantSchema = z.object({
  platform: z.enum(PLATFORMS),
  caption: z.string().min(10).max(2200),
  hashtags: z.array(z.string()).max(15),
});
const GenerateSchema = z.object({
  headline: z.string().min(5).max(140),
  subheadline: z.string().min(5).max(220),
  body_md: z.string().min(50).max(3000),
  landing_slug: z.string().regex(SLUG_RE),
  tags: z.array(z.string()).max(10),
  variants: z.array(PostVariantSchema).min(1),
});

export const generatePostFromProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        property_id: z.string().uuid(),
        platforms: z.array(z.enum(PLATFORMS)).min(1).max(6),
        angle: z.string().max(280).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prop, error: pErr } = await supabase
      .from("properties").select("*").eq("id", data.property_id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Property not found");

    const { data: profile } = await supabase
      .from("profiles").select("full_name, public_slug, public_brokerage")
      .eq("id", userId).maybeSingle();

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const briefs = data.platforms.map((p) => `- ${p}: ${PLATFORM_BRIEFS[p]}`).join("\n");

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: GenerateSchema }),
      system: `You are PropAI's Social Amplifier. Given a real estate listing, generate one shareable landing-page article and per-platform social variants. The landing page is the SEO surface; social posts drive traffic to it. Use specific, honest details from the property data — never invent prices, sizes, or features. Write for buyers, investors, and curious neighbors.`,
      prompt: `Agent: ${profile?.full_name ?? "PropAI Agent"}${profile?.public_brokerage ? ` — ${profile.public_brokerage}` : ""}

Property data:
${JSON.stringify(prop, null, 2)}

${data.angle ? `Story angle the agent wants: ${data.angle}\n` : ""}
Platforms requested: ${data.platforms.join(", ")}

Per-platform briefs:
${briefs}

Generate:
- headline: SEO-friendly H1 for the landing page (include city or zip if available)
- subheadline: one-sentence summary under the H1
- body_md: 250-450 word markdown article. Open with a hook, then highlight the property's strongest 3-5 selling points using bullets where natural, close with a CTA.
- landing_slug: lowercase, hyphenated, 20-80 chars, must end with 5-char random suffix to ensure uniqueness (e.g. "modern-3br-austin-tx-a7k2p")
- tags: 4-8 SEO keywords
- variants: one entry per requested platform following the brief exactly.`,
    });

    return output;
  });

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        property_id: z.string().uuid().nullable().optional(),
        landing_slug: z.string().regex(SLUG_RE),
        headline: z.string().min(5).max(140),
        subheadline: z.string().max(220).optional(),
        body_md: z.string().max(8000),
        hero_image_url: z.string().url().nullable().optional(),
        cta_url: z.string().url().nullable().optional(),
        tags: z.array(z.string()).max(10).default([]),
        publish: z.boolean().default(false),
        scheduled_at: z.string().datetime().nullable().optional(),
        variants: z
          .array(
            z.object({
              platform: z.enum(PLATFORMS),
              caption: z.string().max(2200),
              hashtags: z.array(z.string()).max(15).default([]),
            }),
          )
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const status = data.publish
      ? "published"
      : data.scheduled_at
        ? "scheduled"
        : "draft";

    const { data: post, error } = await supabase
      .from("social_posts")
      .insert({
        user_id: userId,
        property_id: data.property_id ?? null,
        landing_slug: data.landing_slug,
        headline: data.headline,
        subheadline: data.subheadline ?? null,
        body_md: data.body_md,
        hero_image_url: data.hero_image_url ?? null,
        cta_url: data.cta_url ?? null,
        tags: data.tags,
        status,
        scheduled_at: data.scheduled_at ?? null,
        published_at: data.publish ? new Date().toISOString() : null,
        ai_model: "google/gemini-3-flash-preview",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (data.variants.length) {
      const targetRows = data.variants.map((v) => ({
        post_id: post.id,
        user_id: userId,
        platform: v.platform,
        caption: v.caption,
        hashtags: v.hashtags,
        status: "pending" as const,
        scheduled_at: data.scheduled_at ?? null,
      }));
      const { error: tErr } = await supabase.from("social_post_targets").insert(targetRows);
      if (tErr) throw new Error(tErr.message);
    }

    return { id: post.id, landing_slug: post.landing_slug, status: post.status };
  });

export const listMyPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("social_posts")
      .select("id, landing_slug, headline, status, scheduled_at, published_at, hero_image_url, view_count, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMySocialAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("social_accounts")
      .select("id, platform, display_name, avatar_url, status, connected_at")
      .eq("user_id", userId)
      .order("connected_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updatePostStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      post_id: z.string().uuid(),
      action: z.enum(["publish", "unpublish", "cancel", "delete"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.action === "delete") {
      const { error } = await supabase.from("social_posts").delete()
        .eq("id", data.post_id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const patch =
      data.action === "publish"
        ? { status: "published" as const, published_at: new Date().toISOString() }
        : data.action === "unpublish"
          ? { status: "draft" as const, published_at: null }
          : { status: "cancelled" as const };
    const { error } = await supabase.from("social_posts").update(patch)
      .eq("id", data.post_id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePublicProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      public_slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/),
      public_enabled: z.boolean(),
      public_headshot_url: z.string().url().nullable().optional(),
      public_bio: z.string().max(1000).optional(),
      public_phone: z.string().max(40).optional(),
      public_email: z.string().email().optional(),
      public_brokerage: z.string().max(120).optional(),
      public_license: z.string().max(60).optional(),
      public_service_areas: z.array(z.string().max(80)).max(20).default([]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        public_slug: data.public_slug,
        public_enabled: data.public_enabled,
        public_headshot_url: data.public_headshot_url ?? null,
        public_bio: data.public_bio ?? null,
        public_phone: data.public_phone ?? null,
        public_email: data.public_email ?? null,
        public_brokerage: data.public_brokerage ?? null,
        public_license: data.public_license ?? null,
        public_service_areas: data.public_service_areas,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyPublicProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("public_slug, public_enabled, public_headshot_url, public_bio, public_phone, public_email, public_brokerage, public_license, public_service_areas, full_name")
      .eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const listMyProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("properties")
      .select("id, address, city, state, zip, beds, baths, sqft, price, photos")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return [];
    return data ?? [];
  });
