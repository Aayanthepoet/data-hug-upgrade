import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ExternalLink, Globe } from "lucide-react";
import { getMyPublicProfile, updatePublicProfile } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/app/settings/public-profile")({
  head: () => ({ meta: [{ title: "Public profile — PropAI" }] }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const qc = useQueryClient();
  const getProfile = useServerFn(getMyPublicProfile);
  const updateProfile = useServerFn(updatePublicProfile);
  const profileQ = useQuery({ queryKey: ["my-public-profile"], queryFn: () => getProfile() });

  const [form, setForm] = useState({
    public_slug: "",
    public_enabled: false,
    public_headshot_url: "",
    public_bio: "",
    public_phone: "",
    public_email: "",
    public_brokerage: "",
    public_license: "",
    public_service_areas: "",
  });

  useEffect(() => {
    if (profileQ.data) {
      setForm({
        public_slug: profileQ.data.public_slug ?? "",
        public_enabled: profileQ.data.public_enabled ?? false,
        public_headshot_url: profileQ.data.public_headshot_url ?? "",
        public_bio: profileQ.data.public_bio ?? "",
        public_phone: profileQ.data.public_phone ?? "",
        public_email: profileQ.data.public_email ?? "",
        public_brokerage: profileQ.data.public_brokerage ?? "",
        public_license: profileQ.data.public_license ?? "",
        public_service_areas: (profileQ.data.public_service_areas ?? []).join(", "),
      });
    }
  }, [profileQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateProfile({
        data: {
          public_slug: form.public_slug.trim().toLowerCase(),
          public_enabled: form.public_enabled,
          public_headshot_url: form.public_headshot_url || null,
          public_bio: form.public_bio || undefined,
          public_phone: form.public_phone || undefined,
          public_email: form.public_email || undefined,
          public_brokerage: form.public_brokerage || undefined,
          public_license: form.public_license || undefined,
          public_service_areas: form.public_service_areas
            .split(",").map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Public profile saved.");
      qc.invalidateQueries({ queryKey: ["my-public-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/app/settings" className="text-sm text-[var(--w55)] hover:text-foreground">← Back to Settings</Link>
        <h1 className="h-display text-3xl mt-2 flex items-center gap-2">
          <Globe className="w-7 h-7 text-cyan" /> Public agent page
        </h1>
        <p className="text-[var(--w55)] mt-1">
          This is the SEO-indexable page that Google ranks. All your published posts live under it.
        </p>
      </div>

      <div className="border border-border rounded-xl p-6 mb-6 bg-[var(--surface-2)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Make my agent page public</p>
            <p className="text-xs text-[var(--w55)]">
              When off, your page and posts are hidden from search engines.
            </p>
          </div>
          <Switch
            checked={form.public_enabled}
            onCheckedChange={(v) => setForm({ ...form, public_enabled: v })}
          />
        </div>
        {form.public_enabled && form.public_slug && (
          <a
            href={`/agents/${form.public_slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-cyan hover:underline"
          >
            View public page <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="border border-border rounded-xl p-6 space-y-5">
        <div>
          <Label>Public URL slug *</Label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-[var(--w55)] font-mono">/agents/</span>
            <Input
              value={form.public_slug}
              onChange={(e) => setForm({ ...form, public_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              placeholder="jane-doe"
              className="font-mono"
            />
          </div>
          <p className="text-xs text-[var(--w55)] mt-1">3-40 chars, lowercase, dashes ok. Must be unique.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Phone</Label>
            <Input value={form.public_phone} onChange={(e) => setForm({ ...form, public_phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.public_email} onChange={(e) => setForm({ ...form, public_email: e.target.value })} placeholder="jane@brokerage.com" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Brokerage</Label>
            <Input value={form.public_brokerage} onChange={(e) => setForm({ ...form, public_brokerage: e.target.value })} placeholder="ACME Realty" />
          </div>
          <div>
            <Label>License #</Label>
            <Input value={form.public_license} onChange={(e) => setForm({ ...form, public_license: e.target.value })} placeholder="01234567" />
          </div>
        </div>

        <div>
          <Label>Headshot URL</Label>
          <Input value={form.public_headshot_url} onChange={(e) => setForm({ ...form, public_headshot_url: e.target.value })} placeholder="https://…/headshot.jpg" />
        </div>

        <div>
          <Label>Bio</Label>
          <Textarea
            value={form.public_bio}
            onChange={(e) => setForm({ ...form, public_bio: e.target.value })}
            rows={5}
            placeholder="2-3 sentence introduction. This shows up under your name and in social previews."
          />
        </div>

        <div>
          <Label>Service areas (comma separated)</Label>
          <Input
            value={form.public_service_areas}
            onChange={(e) => setForm({ ...form, public_service_areas: e.target.value })}
            placeholder="Austin TX, Round Rock TX, Pflugerville TX"
          />
        </div>

        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !form.public_slug}
          className="btn-primary"
        >
          {saveMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save public profile"}
        </Button>
      </div>
    </div>
  );
}
