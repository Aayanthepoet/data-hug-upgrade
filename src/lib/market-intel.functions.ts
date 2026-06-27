import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/billing/require-subscription.server";

export type MarketIntelCitation = { url: string; title?: string };
export type MarketIntelResult = {
  content: string;
  citations: MarketIntelCitation[];
  cached: boolean;
  fetchedAt: string;
  expiresAt: string;
  locationLabel: string;
};

const inputSchema = z.object({
  propertyId: z.string().uuid(),
  refresh: z.boolean().optional(),
});

const CACHE_HOURS = 24;

export const getMarketIntel = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<MarketIntelResult> => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch ONLY public location info — no owner names, no skip-trace data.
    const { data: prop, error: propErr } = await supabase
      .from("properties")
      .select("id, address, city, neighborhood, state, zip, county")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propErr) throw new Error(propErr.message);
    if (!prop) throw new Error("Property not found");

    const locationLabel = [
      prop.neighborhood,
      prop.city,
      prop.state,
      prop.zip,
    ].filter(Boolean).join(", ") || prop.address || "this area";

    // Check cache
    if (!data.refresh) {
      const { data: cached } = await supabaseAdmin
        .from("market_intel_cache")
        .select("content, citations, created_at, expires_at")
        .eq("property_id", data.propertyId)
        .maybeSingle();
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return {
          content: cached.content,
          citations: (cached.citations as MarketIntelCitation[]) ?? [],
          cached: true,
          fetchedAt: cached.created_at as string,
          expiresAt: cached.expires_at as string,
          locationLabel,
        };
      }
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error("Market Intel is not configured (missing API key).");

    const prompt = `Provide a concise, current real-estate market briefing for ${locationLabel}. Cover:
1. Recent local market trends (price direction, days on market, inventory) over the last 3-6 months.
2. Notable recent home sales or neighborhood news.
3. Public school district ratings and reputation.
4. Any zoning changes, major developments, or infrastructure projects nearby.

Use short markdown sections with headings. Cite sources inline. Keep it under 400 words. Do not invent facts; if data is unavailable, say so.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a real estate market analyst. Be precise, cite sources, and avoid speculation." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Perplexity request failed (${res.status}). ${txt.slice(0, 200)}`);
    }

    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
      search_results?: Array<{ url: string; title?: string }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty response from market intel provider.");

    const citations: MarketIntelCitation[] = json.search_results?.length
      ? json.search_results.map((s) => ({ url: s.url, title: s.title }))
      : (json.citations ?? []).map((url) => ({ url }));

    const now = new Date();
    const expires = new Date(now.getTime() + CACHE_HOURS * 60 * 60 * 1000);

    await supabaseAdmin.from("market_intel_cache").upsert({
      property_id: data.propertyId,
      location_key: locationLabel,
      content,
      citations,
      model: "sonar",
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
    }, { onConflict: "property_id" });

    return {
      content,
      citations,
      cached: false,
      fetchedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      locationLabel,
    };
  });
