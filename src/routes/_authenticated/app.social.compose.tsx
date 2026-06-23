import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Globe, Check } from "lucide-react";
import {
  generatePostFromProperty,
  savePost,
  listMyProperties,
  getMyPublicProfile,
} from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X / Twitter",
  youtube: "YouTube Shorts",
  tiktok: "TikTok",
};
const PLATFORMS = ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"] as const;

export const Route = createFileRoute("/_authenticated/app/social/compose")({
  head: () => ({ meta: [{ title: "Compose post — PropAI Social" }] }),
  component: ComposePage,
});

type Variant = { platform: (typeof PLATFORMS)[number]; caption: string; hashtags: string[] };

function ComposePage() {
  const navigate = useNavigate();
  const generate = useServerFn(generatePostFromProperty);
  const save = useServerFn(savePost);
  const listProps = useServerFn(listMyProperties);
  const getProfile = useServerFn(getMyPublicProfile);

  const propertiesQ = useQuery({ queryKey: ["my-properties"], queryFn: () => listProps() });
  const profileQ = useQuery({ queryKey: ["my-public-profile"], queryFn: () => getProfile() });

  const [propertyId, setPropertyId] = useState<string>("");
  const [angle, setAngle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(["facebook", "instagram", "linkedin"]));
  const [draft, setDraft] = useState<{
    headline: string; subheadline: string; body_md: string;
    landing_slug: string; tags: string[]; variants: Variant[];
  } | null>(null);

  const genMut = useMutation({
    mutationFn: () =>
      generate({
        data: {
          property_id: propertyId,
          platforms: Array.from(selected) as Variant["platform"][],
          angle: angle || undefined,
        },
      }),
    onSuccess: (out) => {
      setDraft(out);
      toast.success("AI draft ready — review and publish below.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: (publish: boolean) => {
      if (!draft) throw new Error("Generate a draft first.");
      const prop = propertiesQ.data?.find((p) => p.id === propertyId);
      const hero = prop?.photos?.[0] ?? null;
      return save({
        data: {
          property_id: propertyId || null,
          landing_slug: draft.landing_slug,
          headline: draft.headline,
          subheadline: draft.subheadline,
          body_md: draft.body_md,
          hero_image_url: hero,
          cta_url: null,
          tags: draft.tags,
          publish,
          variants: draft.variants,
        },
      });
    },
    onSuccess: (res, publish) => {
      toast.success(publish ? "Published! Your SEO landing page is live." : "Draft saved.");
      if (publish && profileQ.data?.public_slug) {
        navigate({
          to: "/agents/$slug/p/$postSlug",
          params: { slug: profileQ.data.public_slug, postSlug: res.landing_slug },
        });
      } else {
        navigate({ to: "/app/social" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needsProfile = !profileQ.data?.public_enabled || !profileQ.data?.public_slug;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link to="/app/social" className="text-sm text-[var(--w55)] hover:text-foreground">← Back to Social</Link>
        <h1 className="h-display text-3xl mt-2">Compose AI Post</h1>
        <p className="text-[var(--w55)] mt-1">Pick a property, generate platform-tailored content, and publish a public SEO landing page.</p>
      </div>

      {needsProfile && (
        <div className="mb-6 p-4 rounded-lg border border-gold/40 bg-gold/5 flex items-center justify-between">
          <div>
            <p className="font-medium">Set up your public agent page first</p>
            <p className="text-sm text-[var(--w55)]">Posts publish under <code>/agents/your-slug/</code> — that's the page Google ranks.</p>
          </div>
          <Link to="/app/settings/public-profile" className="btn-primary px-4 py-2 text-sm whitespace-nowrap">Set up</Link>
        </div>
      )}

      <section className="border border-border rounded-xl p-6 mb-6 bg-[var(--surface-2)]">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan" /> 1. Source &amp; angle</h2>
        <div className="grid gap-4">
          <div>
            <Label>Property</Label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full bg-[var(--surface-1)] border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a property…</option>
              {propertiesQ.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.address, p.city, p.state].filter(Boolean).join(", ") || `Property ${p.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Story angle (optional)</Label>
            <Input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="e.g. great investment for first-time buyers; rare lot size; recent renovation"
            />
          </div>
          <div>
            <Label className="mb-2 block">Platforms</Label>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selected.has(p)}
                    onCheckedChange={(c) => {
                      const next = new Set(selected);
                      if (c) next.add(p); else next.delete(p);
                      setSelected(next);
                    }}
                  />
                  {PLATFORM_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={() => genMut.mutate()}
            disabled={!propertyId || selected.size === 0 || genMut.isPending}
            className="btn-primary mt-2"
          >
            {genMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>}
          </Button>
        </div>
      </section>

      {draft && (
        <section className="border border-border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-cyan" /> 2. Landing page (SEO)</h2>
          <div className="grid gap-4">
            <div>
              <Label>Headline (H1)</Label>
              <Input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
            </div>
            <div>
              <Label>Subheadline / meta description</Label>
              <Input value={draft.subheadline} onChange={(e) => setDraft({ ...draft, subheadline: e.target.value })} />
            </div>
            <div>
              <Label>URL slug</Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--w55)] font-mono">/agents/{profileQ.data?.public_slug || "you"}/p/</span>
                <Input
                  value={draft.landing_slug}
                  onChange={(e) => setDraft({ ...draft, landing_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Body (Markdown, ~300 words)</Label>
              <Textarea
                value={draft.body_md}
                onChange={(e) => setDraft({ ...draft, body_md: e.target.value })}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>SEO tags</Label>
              <p className="text-xs text-[var(--w55)]">{draft.tags.join(", ")}</p>
            </div>
          </div>
        </section>
      )}

      {draft && (
        <section className="border border-border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">3. Social variants</h2>
          <div className="space-y-5">
            {draft.variants.map((v, i) => (
              <div key={v.platform} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{PLATFORM_LABELS[v.platform]}</span>
                  <span className="text-xs text-[var(--w55)]">{v.caption.length} chars</span>
                </div>
                <Textarea
                  value={v.caption}
                  onChange={(e) => {
                    const next = [...draft.variants];
                    next[i] = { ...v, caption: e.target.value };
                    setDraft({ ...draft, variants: next });
                  }}
                  rows={4}
                  className="text-sm"
                />
                {v.hashtags.length > 0 && (
                  <p className="text-xs text-cyan mt-2 break-all">{v.hashtags.map((h) => `#${h}`).join(" ")}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--w55)] mt-4">
            Cross-posting to social platforms requires connecting each account — visit Settings → Social accounts. For now, the SEO landing page is the primary distribution channel.
          </p>
        </section>
      )}

      {draft && (
        <div className="flex gap-3 sticky bottom-4 bg-bg/80 backdrop-blur p-4 rounded-xl border border-border">
          <Button
            onClick={() => saveMut.mutate(false)}
            disabled={saveMut.isPending}
            className="btn-ghost"
          >
            Save as draft
          </Button>
          <Button
            onClick={() => saveMut.mutate(true)}
            disabled={saveMut.isPending || needsProfile}
            className="btn-primary"
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Publish landing page
          </Button>
        </div>
      )}
    </div>
  );
}
