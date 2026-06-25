import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useIsFetching, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Inbox, Loader2 } from "lucide-react";
import { useTeamMembers, memberLabel, type TeamMember } from "@/hooks/use-team-members";

export const Route = createFileRoute("/_authenticated/app/leads")({
  head: () => ({ meta: [{ title: "Leads — PropAI" }] }),
  component: LeadsPage,
});

type Lead = {
  id: string;
  full_name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
};

function LeadsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");

  const isNavigating = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  const fetchingCount = useIsFetching();

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const queryClient = useQueryClient();
  const assignMutation = useMutation({
    mutationFn: async ({ leadId, assignedTo }: { leadId: string; assignedTo: string | null }) => {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: assignedTo })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("leads.toast.assignUpdated"));
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message || t("leads.toast.assignFailed")),
  });

  const { data: members = [] } = useTeamMembers();
  const memberMap = useMemo(() => {
    const m = new Map<string, TeamMember>();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))) as string[],
    [leads],
  );
  const statuses = useMemo(
    () => Array.from(new Set(leads.map((l) => l.status).filter(Boolean))) as string[],
    [leads],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (source !== "all" && l.source !== source) return false;
      if (assignee === "unassigned" && l.assigned_to) return false;
      if (assignee !== "all" && assignee !== "unassigned" && l.assigned_to !== assignee) return false;
      if (!q) return true;
      return [l.full_name, l.email, l.company, l.phone, l.message, l.source]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, search, status, source, assignee]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--w55)]">{t("leads.eyebrow")}</p>
        <h1 className="text-3xl font-bold mt-1">
          {t("leads.headingA")} <span className="h-italic">{t("leads.headingB")}</span>
        </h1>
        <p className="text-sm text-[var(--w55)] mt-2">
          {t("leads.subtitle")}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w55)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("leads.searchPlaceholder")}
            className="pl-9 pr-9"
          />
          {fetchingCount > 0 ? (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w55)] animate-spin"
              aria-label={t("leads.searchAria")}
            />
          ) : null}
        </div>
        {search.trim() ? (
          <Link
            to="/app/properties/search"
            search={{ q: search.trim() }}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-cyan text-black text-sm font-medium hover:opacity-90 whitespace-nowrap disabled:opacity-60"
            aria-busy={isNavigating}
          >
            {isNavigating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isNavigating ? t("leads.searching") : t("leads.searchProperties")}
          </Link>
        ) : null}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-40"><SelectValue placeholder={t("leads.statusPlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.allStatuses")}</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="md:w-40"><SelectValue placeholder={t("leads.sourcePlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.allSources")}</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder={t("leads.assigneePlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.allAssignees")}</SelectItem>
            <SelectItem value="unassigned">{t("leads.unassigned")}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-[var(--w55)]">
        {t("leads.countOf", { filtered: filtered.length, total: leads.length })}
      </div>

      {error ? (
        <div className="border border-border rounded-lg p-6 text-sm text-red-400">
          {t("leads.loadError")}
        </div>
      ) : isLoading ? (
        <div className="border border-border rounded-lg p-10 flex items-center justify-center gap-3 text-sm text-[var(--w55)]">
          <Loader2 className="h-5 w-5 animate-spin text-cyan" aria-hidden="true" />
          <span>{t("leads.loadingLeads")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-[var(--w45)]" />
          <p className="mt-3 text-sm text-[var(--w55)]">{t("leads.noMatch")}</p>
          {search.trim() && /\d/.test(search) ? (
            <p className="mt-4 text-sm text-[var(--w55)]">
              {t("leads.tryProperty")}{" "}
              <Link
                to="/app/properties/search"
                search={{ q: search.trim() }}
                className="text-cyan hover:underline"
              >
                {t("leads.findDistressed")}
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(255,255,255,.03)] text-left text-xs uppercase tracking-wider text-[var(--w55)]">
              <tr>
                <th className="px-4 py-3">{t("leads.col.name")}</th>
                <th className="px-4 py-3">{t("leads.col.email")}</th>
                <th className="px-4 py-3">{t("leads.col.company")}</th>
                <th className="px-4 py-3">{t("leads.col.source")}</th>
                <th className="px-4 py-3">{t("leads.col.status")}</th>
                <th className="px-4 py-3">{t("leads.col.assignee")}</th>
                <th className="px-4 py-3">{t("leads.col.submitted")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-border align-top hover:bg-[rgba(255,255,255,.02)]">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to="/app/leads/$leadId"
                      params={{ leadId: l.id }}
                      className="hover:text-cyan"
                    >
                      {l.full_name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {l.email ? (
                      <a href={`mailto:${l.email}`} className="text-cyan hover:underline">{l.email}</a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">{l.company || "—"}</td>
                  <td className="px-4 py-3">{l.source || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{l.status || "new"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={l.assigned_to ?? "unassigned"}
                      onValueChange={(value) =>
                        assignMutation.mutate({
                          leadId: l.id,
                          assignedTo: value === "unassigned" ? null : value,
                        })
                      }
                      disabled={assignMutation.isPending}
                    >
                      <SelectTrigger className="h-8 w-48">
                        <SelectValue placeholder={t("leads.unassigned")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">{t("leads.unassigned")}</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-[var(--w55)] whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
