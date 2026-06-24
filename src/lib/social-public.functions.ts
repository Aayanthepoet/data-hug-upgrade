import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const SLUG = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,80}[a-z0-9])$/);

export const getPublicAgent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: SLUG }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: agent } = await sb
      .from("public_profiles")
      .select("id, full_name, public_slug, public_headshot_url, public_bio, public_phone, public_email, public_brokerage, public_license, public_service_areas")
      .eq("public_slug", data.slug)
      .maybeSingle();
    if (!agent) return null;

    const { data: posts } = await sb
      .from("social_posts")
      .select("id, landing_slug, headline, subheadline, hero_image_url, published_at, tags")
      .eq("user_id", agent.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);

    return { agent, posts: posts ?? [] };
  });

export const getPublicPost = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ agentSlug: SLUG, postSlug: SLUG }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: agent } = await sb
      .from("public_profiles")
      .select("id, full_name, public_slug, public_headshot_url, public_bio, public_phone, public_email, public_brokerage, public_license")
      .eq("public_slug", data.agentSlug)
      .maybeSingle();
    if (!agent) return null;

    const { data: post } = await sb
      .from("social_posts")
      .select("id, landing_slug, headline, subheadline, body_md, hero_image_url, cta_label, cta_url, tags, published_at, property_id")
      .eq("user_id", agent.id)
      .eq("landing_slug", data.postSlug)
      .eq("status", "published")
      .maybeSingle();
    if (!post) return null;

    let property: {
      id: string; address: string | null; city: string | null; state: string | null;
      zip: string | null; beds: number | null; baths: number | null; sqft: number | null;
      price: number | null; photos: string[] | null;
    } | null = null;
    if (post.property_id) {
      const { data: p } = await sb
        .from("properties")
        .select("id, address, city, state, zip, beds, baths, sqft, price, photos")
        .eq("id", post.property_id)
        .maybeSingle();
      property = (p as typeof property) ?? null;
    }

    return { agent, post, property };
  });

export const listPublicAgents = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data } = await sb
      .from("public_profiles")
      .select("public_slug, full_name, public_headshot_url, public_brokerage")
      .limit(500);
    return data ?? [];
  });

export const listPublishedPostsForSitemap = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data: agents } = await sb
      .from("public_profiles")
      .select("id, public_slug");
    const slugById = new Map((agents ?? []).map((a) => [a.id as string, a.public_slug as string]));
    if (slugById.size === 0) return [];

    const { data: posts } = await sb
      .from("social_posts")
      .select("landing_slug, published_at, user_id")
      .eq("status", "published")
      .in("user_id", Array.from(slugById.keys()))
      .order("published_at", { ascending: false })
      .limit(2000);
    return (posts ?? [])
      .map((r) => {
        const agentSlug = slugById.get(r.user_id as string);
        if (!agentSlug) return null;
        return { postSlug: r.landing_slug, agentSlug, published_at: r.published_at };
      })
      .filter((x): x is { postSlug: string; agentSlug: string; published_at: string } => x !== null);
  });
