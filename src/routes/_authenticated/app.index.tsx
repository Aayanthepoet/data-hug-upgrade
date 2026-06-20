import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Overview — PropAI" }] }),
  component: Overview,
});

const tiles = [
  { name: "Properties", to: "/app/properties", table: "properties" as const, color: "var(--cyan)" },
  { name: "Owners", to: "/app/owners", table: "owners" as const, color: "var(--gold)" },
  { name: "Contacts", to: "/app/contacts", table: "contacts" as const, color: "var(--violet)" },
  { name: "Lead Lists", to: "/app/lead-lists", table: "lead_lists" as const, color: "var(--green)" },
  { name: "Campaigns", to: "/app/campaigns", table: "campaigns" as const, color: "var(--cyan)" },
  { name: "Auctions", to: "/app/auctions", table: "auctions" as const, color: "var(--gold)" },
  { name: "Videos", to: "/app/videos", table: "videos" as const, color: "var(--red)" },
];

function Overview() {
  const { user } = useAuth();

  const { data: counts } = useQuery({
    queryKey: ["overview-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const results = await Promise.all(
        tiles.map((t) =>
          supabase.from(t.table).select("*", { count: "exact", head: true }).then((r) => r.count ?? 0),
        ),
      );
      return Object.fromEntries(tiles.map((t, i) => [t.table, results[i]])) as Record<string, number>;
    },
  });

  return (
    <div>
      <div className="eyebrow inline-flex">
        <span className="eyebrow-dot" />
        Welcome back
      </div>
      <h1 className="h-display text-[clamp(32px,4.5vw,52px)] mt-4">
        Your <span className="h-italic">workspace</span>
      </h1>
      <p className="text-[var(--w55)] mt-3 max-w-xl">
        Signed in as <span className="text-white">{user?.email}</span>. Pick a module to start
        adding data — everything is private to your account.
      </p>

      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link key={t.name} to={t.to} className="surface p-5 hover:border-cyan transition">
            <div className="text-xs uppercase tracking-widest font-bold" style={{ color: t.color }}>
              {t.name}
            </div>
            <div className="text-3xl font-bold mt-3">{counts?.[t.table] ?? "—"}</div>
            <div className="text-xs text-[var(--w45)] mt-1">records</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
