import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Globe, ExternalLink, Trash2, Share2, Link2, Building2 } from "lucide-react";
import {
  listMyPosts,
  listMySocialAccounts,
  updatePostStatus,
  getMyPublicProfile,
} from "@/lib/social.functions";
import { disconnectSocialAccount } from "@/lib/social-oauth.functions";
import { MetaAccountPicker } from "@/components/social/MetaAccountPicker";
import { Button } from "@/components/ui/button";

const PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X / Twitter" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
];

export const Route = createFileRoute("/_authenticated/app/social")({
  head: () => ({ meta: [{ title: "Social — PropAI" }] }),
  component: SocialHubPage,
});

function SocialHubPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyPosts);
  const listAccts = useServerFn(listMySocialAccounts);
  const getProfile = useServerFn(getMyPublicProfile);
  const updateStatus = useServerFn(updatePostStatus);
  const disconnect = useServerFn(disconnectSocialAccount);

  const [pickerOpen, setPickerOpen] = useState(false);

  const postsQ = useQuery({ queryKey: ["my-social-posts"], queryFn: () => list() });
  const accountsQ = useQuery({ queryKey: ["my-social-accounts"], queryFn: () => listAccts() });
  const profileQ = useQuery({ queryKey: ["my-public-profile"], queryFn: () => getProfile() });

  // Surface OAuth callback errors from /api/public/oauth/meta/callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("meta_error");
    const ok = params.get("connected");
    if (err) {
      toast.error(
        err === "not_configured"
          ? "Meta OAuth isn't configured yet. Use Connect (Simulated) to test the flow."
          : `Meta connect failed: ${err}`,
      );
      window.history.replaceState({}, "", "/app/social");
    } else if (ok === "meta") {
      // Real OAuth returned — open the picker to choose which Pages/IG to use.
      window.history.replaceState({}, "", "/app/social");
      setPickerOpen(true);
    }
  }, []);

  const actMut = useMutation({
    mutationFn: (vars: { post_id: string; action: "publish" | "unpublish" | "delete" }) =>
      updateStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Updated.");
      qc.invalidateQueries({ queryKey: ["my-social-posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const disconnectMut = useMutation({
    mutationFn: (account_id: string) => disconnect({ data: { account_id } }),
    onSuccess: () => {
      toast.success("Disconnected.");
      qc.invalidateQueries({ queryKey: ["my-social-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const slug = profileQ.data?.public_slug;
  const profileEnabled = profileQ.data?.public_enabled;
  const metaConnected = accountsQ.data?.some((a) => a.platform === "facebook" || a.platform === "instagram");

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="h-display text-3xl flex items-center gap-2"><Share2 className="w-7 h-7 text-cyan" /> Social Amplifier</h1>
          <p className="text-[var(--w55)] mt-1">AI-generated SEO landing pages + multi-platform social posts.</p>
        </div>
        <Link to="/app/social/compose" className="btn-primary px-5 py-2 inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> New post
        </Link>
      </div>

      {(!profileEnabled || !slug) && (
        <div className="mb-6 p-4 border border-gold/40 bg-gold/5 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-medium flex items-center gap-2"><Globe className="w-4 h-4" /> Set up your public agent page</p>
            <p className="text-sm text-[var(--w55)]">Required before publishing posts — this is the URL Google ranks.</p>
          </div>
          <Link to="/app/settings/public-profile" className="btn-ghost px-4 py-2 text-sm">Set up</Link>
        </div>
      )}

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Connected social accounts</h2>
          <Button
            onClick={() => setPickerOpen(true)}
            className="btn-primary px-3 py-1.5 text-xs h-auto inline-flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" />
            {metaConnected ? "Manage Pages & IG" : "Connect Facebook + Instagram"}
          </Button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {PLATFORMS.map((p) => {
            const accts = accountsQ.data?.filter((a) => a.platform === p.id) ?? [];
            const isMeta = p.id === "facebook" || p.id === "instagram";
            return (
              <div key={p.id} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{p.label}</span>
                  {accts.length > 0 ? (
                    <span className="text-xs text-green-400">● {accts.length} connected</span>
                  ) : (
                    <span className="text-xs text-[var(--w35)]">Not connected</span>
                  )}
                </div>
                {accts.length > 0 ? (
                  <div className="space-y-1.5">
                    {accts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <p className="text-xs text-[var(--w55)] truncate flex-1">{a.display_name}</p>
                        <button
                          onClick={() => disconnectMut.mutate(a.id)}
                          className="text-xs text-[var(--w55)] hover:text-red-400"
                          title="Disconnect"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : isMeta ? (
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="text-xs text-cyan hover:underline"
                  >
                    Choose accounts →
                  </button>
                ) : (
                  <span className="text-xs text-[var(--w35)]">Coming soon</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[var(--w55)] mt-3">
          Meta OAuth is scaffolded at <code>/api/public/oauth/meta/start</code>. Add <code>META_APP_ID</code> and <code>META_APP_SECRET</code> secrets to switch from simulated to real Facebook + Instagram posting.
        </p>
      </section>

      <MetaAccountPicker open={pickerOpen} onOpenChange={setPickerOpen} />



      <section>
        <h2 className="font-semibold mb-3">Your posts</h2>
        {!postsQ.data?.length ? (
          <div className="border border-dashed border-border rounded-xl p-10 text-center">
            <p className="text-[var(--w55)] mb-4">No posts yet.</p>
            <Link to="/app/social/compose" className="btn-primary px-5 py-2">Create your first post</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {postsQ.data.map((p) => (
              <div key={p.id} className="border border-border rounded-lg p-4 flex items-center gap-4">
                {p.hero_image_url ? (
                  <img src={p.hero_image_url} alt="" className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 rounded bg-[var(--surface-2)] flex items-center justify-center text-[var(--w35)]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.headline}</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--w55)] mt-1">
                    <span className={
                      p.status === "published" ? "text-green-400"
                      : p.status === "scheduled" ? "text-cyan"
                      : p.status === "failed" ? "text-red-400" : ""
                    }>
                      ● {p.status}
                    </span>
                    <span>·</span>
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    {p.view_count > 0 && (<><span>·</span><span>{p.view_count} views</span></>)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.status === "published" && slug && (
                    <a
                      href={`/agents/${slug}/p/${p.landing_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost px-3 py-1 text-xs inline-flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {p.status !== "published" ? (
                    <Button
                      onClick={() => actMut.mutate({ post_id: p.id, action: "publish" })}
                      className="btn-primary px-3 py-1 text-xs h-auto"
                      disabled={!profileEnabled}
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      onClick={() => actMut.mutate({ post_id: p.id, action: "unpublish" })}
                      className="btn-ghost px-3 py-1 text-xs h-auto"
                    >
                      Unpublish
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      if (confirm("Delete this post permanently?"))
                        actMut.mutate({ post_id: p.id, action: "delete" });
                    }}
                    className="btn-ghost px-2 py-1 text-xs h-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
