import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Link2 } from "lucide-react";
import {
  generateRedesign,
  listRenders,
  deleteRender,
  linkRenderToProperty,
  listPropertiesForRender,
} from "@/lib/vision/vision.functions";

export const Route = createFileRoute("/_authenticated/app/vision")({
  head: () => ({ meta: [{ title: "Vision Studio — PropAI" }] }),
  component: VisionPage,
});

function VisionPage() {
  const qc = useQueryClient();
  const generateFn = useServerFn(generateRedesign);
  const listFn = useServerFn(listRenders);
  const deleteFn = useServerFn(deleteRender);
  const linkFn = useServerFn(linkRenderToProperty);
  const propsFn = useServerFn(listPropertiesForRender);

  const [prompt, setPrompt] = useState(
    "Living room with hardwood floors, large windows, neutral walls — propose a redesign that maximizes resale appeal",
  );
  const [style, setStyle] = useState<"modern" | "scandinavian" | "industrial" | "farmhouse" | "mid-century" | "coastal">("modern");
  const [propertyId, setPropertyId] = useState<string>("none");

  const { data: renders = [] } = useQuery({
    queryKey: ["vision-renders"],
    queryFn: () => listFn({ data: {} }),
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["vision-properties"],
    queryFn: () => propsFn(),
  });

  const generate = useMutation({
    mutationFn: () =>
      generateFn({
        data: {
          prompt,
          style,
          property_id: propertyId === "none" ? null : propertyId,
        },
      }),
    onSuccess: () => {
      toast.success("Redesign rendered");
      qc.invalidateQueries({ queryKey: ["vision-renders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Render failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["vision-renders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const link = useMutation({
    mutationFn: ({ id, property_id }: { id: string; property_id: string | null }) =>
      linkFn({ data: { id, property_id } }),
    onSuccess: () => {
      toast.success("Linked");
      qc.invalidateQueries({ queryKey: ["vision-renders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Link failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Vision Studio · redesign · history</div>
        <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">
          Property <span className="h-italic">redesign</span>
        </h1>
        <p className="text-[var(--w55)] mt-3 max-w-xl">
          Generate redesign concepts for distressed rooms to show sellers the after-state.
          Renders are saved to your library with status, prompt, and property linkage.
        </p>
      </div>

      <div className="surface p-6 space-y-3">
        <div>
          <label className="text-xs text-[var(--w55)]">Describe the room</label>
          <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-[var(--w55)]">Style</label>
            <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="scandinavian">Scandinavian</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
                <SelectItem value="farmhouse">Farmhouse</SelectItem>
                <SelectItem value="mid-century">Mid-century</SelectItem>
                <SelectItem value="coastal">Coastal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-[var(--w55)]">Link to property (optional)</label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}{p.city ? `, ${p.city}` : ""}{p.state ? ` ${p.state}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "Rendering…" : "Generate redesign"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Render history</h2>
          <span className="text-xs text-[var(--w55)]">{renders.length} total</span>
        </div>
        {renders.length === 0 ? (
          <div className="surface p-8 text-center text-sm text-[var(--w55)]">
            No renders yet. Generate one above.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renders.map((r) => (
              <div key={r.id} className="surface p-3 space-y-2">
                <div className="aspect-video bg-black/20 rounded overflow-hidden flex items-center justify-center">
                  {r.status === "ready" && r.signed_url ? (
                    <img src={r.signed_url} alt={r.prompt ?? ""} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-[var(--w55)]">
                      {r.status === "failed" ? "Failed" : "Rendering…"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={r.status} />
                  {r.style && <Badge variant="outline" className="text-xs">{r.style}</Badge>}
                  {r.properties && (
                    <Badge variant="outline" className="text-xs">
                      <Link2 className="h-3 w-3 mr-1" />
                      {r.properties.address}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--w55)] line-clamp-2">{r.prompt}</p>
                {r.status === "failed" && r.error && (
                  <p className="text-xs text-red-400 line-clamp-2">{r.error}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <Select
                    value={r.property_id ?? "none"}
                    onValueChange={(v) =>
                      link.mutate({ id: r.id, property_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs flex-1 mr-2">
                      <SelectValue placeholder="Link to…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unlinked</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove.mutate(r.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-green-500/15 text-green-400 border-green-500/30",
    rendering: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    queued: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
