import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Search, Inbox } from "lucide-react";

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
  created_at: string;
};

function LeadsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");

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
      if (!q) return true;
      return [l.full_name, l.email, l.company, l.phone, l.message]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, search, status, source]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--w55)]">Leads</p>
        <h1 className="text-3xl font-bold mt-1">
          Submitted <span className="h-italic">leads</span>
        </h1>
        <p className="text-sm text-[var(--w55)] mt-2">
          Browse, search and filter every lead captured from your site.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w55)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company, message…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="md:w-44"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
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
