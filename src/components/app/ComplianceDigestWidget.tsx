import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, TrendingUp, TrendingDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface DigestStats {
  optOutsThisWeek: number;
  optOutsLastWeek: number;
  deltaPct: number | null;
  blockedSends: number;
  keywordBreakdown: { keyword: string; count: number }[];
}

export function ComplianceDigestWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      return !!data;
    },
  });

  const { data: digest } = useQuery({
    queryKey: ["compliance-digest-latest", user?.id],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_digests")
        .select("id, period_start, period_end, stats, compliance_digest_reads!left(user_id)")
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dismiss = useMutation({
    mutationFn: async (digestId: string) => {
      if (!user) return;
      await supabase
        .from("compliance_digest_reads")
        .insert({ digest_id: digestId, user_id: user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance-digest-latest"] }),
  });

  const alreadyRead = useMemo(() => {
    if (!digest || !user) return false;
    const reads = (digest as any).compliance_digest_reads as { user_id: string }[] | null;
    return !!reads?.some((r) => r.user_id === user.id);
  }, [digest, user]);

  if (!isAdmin || !digest || alreadyRead) return null;

  const stats = (digest.stats as unknown as DigestStats) ?? {
    optOutsThisWeek: 0,
    optOutsLastWeek: 0,
    deltaPct: 0,
    blockedSends: 0,
    keywordBreakdown: [],
  };
  const start = new Date(digest.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const end = new Date(digest.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const delta = stats.deltaPct ?? 0;
  const up = delta > 0;
  const flat = delta === 0;

  return (
    <div className="surface p-5 relative" style={{ borderColor: "var(--gold-b)", background: "var(--gold-d)" }}>
      <button
        onClick={() => dismiss.mutate(digest.id)}
        className="absolute top-3 right-3 text-[var(--w55)] hover:text-white"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-gold" />
        <div className="text-xs uppercase tracking-widest font-bold text-gold">
          Weekly compliance digest · {start}–{end}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--w55)]">New opt-outs</div>
          <div className="text-2xl font-bold mt-1">{stats.optOutsThisWeek}</div>
          <div className={`text-xs mt-1 flex items-center gap-1 ${up ? "text-red" : flat ? "text-[var(--w55)]" : "text-green"}`}>
            {flat ? null : up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {flat ? "no change" : `${Math.abs(delta)}% vs last week`}
          </div>
        </div>

        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Last week</div>
          <div className="text-2xl font-bold mt-1">{stats.optOutsLastWeek}</div>
          <div className="text-xs text-[var(--w55)] mt-1">opt-outs</div>
        </div>

        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Blocked sends</div>
          <div className="text-2xl font-bold mt-1">{stats.blockedSends}</div>
          <div className="text-xs text-[var(--w55)] mt-1">stopped by suppression</div>
        </div>

        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--w55)]">Top keyword</div>
          <div className="text-2xl font-bold mt-1">
            {stats.keywordBreakdown[0]?.keyword ?? "—"}
          </div>
          <div className="text-xs text-[var(--w55)] mt-1">
            {stats.keywordBreakdown[0]?.count ?? 0} mentions
          </div>
        </div>
      </div>

      {stats.keywordBreakdown.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {stats.keywordBreakdown.map((k) => (
            <span
              key={k.keyword}
              className="text-xs px-2 py-1 rounded border"
              style={{ borderColor: "var(--w15)", background: "var(--w05)" }}
            >
              <span className="font-bold">{k.keyword}</span>{" "}
              <span className="text-[var(--w55)]">{k.count}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
