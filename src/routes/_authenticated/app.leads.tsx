import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useIsFetching } from "@tanstack/react-query";
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
      return [l.full_name, l.email, l.company, l.phone, l.message]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, search, status, source, assignee]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--w55)]">Leads</p>
        <h1 className="text-3xl font-bold mt-1">
          Submitted <span className="h-italic">leads</span>
        </h1>
        <p className="text-sm text-[var(--w55)] mt-2">
          Browse, search, filter and assign every lead captured from your site.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w55)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company, message…"
            className="pl-9 pr-9"
          />
          {fetchingCount > 0 ? (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w55)] animate-spin"
              aria-label="Loading"
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
            {isNavigating ? "Searching…" : "Search Properties"}
          </Link>
        ) : null}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="md:w-40"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-[var(--w55)]">
        {filtered.length} of {leads.length} leads
      </div>

      {error ? (
        <div className="border border-border rounded-lg p-6 text-sm text-red-400">
          Couldn't load leads. You may not have admin access.
        </div>
      ) : isLoading ? (
        <div className="border border-border rounded-lg p-6 text-sm text-[var(--w55)]">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-[var(--w45)]" />
          <p className="mt-3 text-sm text-[var(--w55)]">No leads match your filters.</p>
          {search.trim() && /\d/.test(search) ? (
            <p className="mt-4 text-sm text-[var(--w55)]">
              Looking for a property address? Try{" "}
              <Link
                to="/app/properties/search"
                search={{ q: search.trim() }}
                className="text-cyan hover:underline"
              >
                Find Distressed Properties
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Submitted</th>
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
                    {l.assigned_to ? (
                      memberLabel(memberMap.get(l.assigned_to))
                    ) : (
                      <span className="text-[var(--w55)]">Unassigned</span>
                    )}
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
