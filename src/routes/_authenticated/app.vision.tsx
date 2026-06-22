import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/vision")({
  head: () => ({ meta: [{ title: "Vision Studio — PropAI" }] }),
  component: VisionPage,
});

function VisionPage() {
  const [prompt, setPrompt] = useState("Living room with hardwood floors, large windows, neutral walls — propose a redesign that maximizes resale appeal");
  const [style, setStyle] = useState("modern");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setImage(null);
    try {
      const res = await fetch("/api/engines/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as { image: string | null };
      if (!json.image) throw new Error("No image returned");
      setImage(json.image);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Vision Studio · redesign · upscaling</div>
        <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">Property <span className="h-italic">redesign</span></h1>
        <p className="text-[var(--w55)] mt-3 max-w-xl">Generate redesign concepts for distressed rooms to show sellers the after-state.</p>
      </div>

      <div className="surface p-6 space-y-3">
        <div>
          <label className="text-xs text-[var(--w55)]">Describe the room</label>
          <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-[200px_1fr] gap-3 items-end">
          <div>
            <label className="text-xs text-[var(--w55)]">Style</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="scandinavian">Scandinavian</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
                <SelectItem value="farmhouse">Farmhouse</SelectItem>
                <SelectItem value="mid-century">Mid-century</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={loading}>{loading ? "Rendering…" : "Generate redesign"}</Button>
        </div>
      </div>

      {image && (
        <div className="surface p-3">
          <img src={image} alt="Redesigned room" className="w-full rounded" />
        </div>
      )}
    </div>
  );
}
