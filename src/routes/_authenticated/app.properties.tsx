import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyModule } from "@/components/app/EmptyModule";

export const Route = createFileRoute("/_authenticated/app/properties")({
  head: () => ({ meta: [{ title: "Properties — PropAI" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, address, city, state, zip, estimated_value, lead_score, is_preforeclosure, is_vacant, is_absentee")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-[var(--w55)]">Loading…</div>;
  if (!data?.length) {
    return (
      <EmptyModule
        eyebrow="Properties"
        title={<>Property <span className="h-italic">intelligence</span></>}
        description="Nationwide property records with equity, distress signals, and AI lead scoring. Search and list-building arrive in Phase 4 with the data-provider integration."
      />
    );
  }

  return (
    <div>
      <h1 className="h-display text-[clamp(28px,4vw,44px)]">Properties</h1>
      <div className="surface mt-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--w55)] text-xs uppercase tracking-widest">
            <tr><th className="p-4">Address</th><th className="p-4">City</th><th className="p-4">Value</th><th className="p-4">Score</th></tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-4">{p.address}</td>
                <td className="p-4">{p.city}, {p.state} {p.zip}</td>
                <td className="p-4">{p.estimated_value ? `$${Number(p.estimated_value).toLocaleString()}` : "—"}</td>
                <td className="p-4">{p.lead_score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
