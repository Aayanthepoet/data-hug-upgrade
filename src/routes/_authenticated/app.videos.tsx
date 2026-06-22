import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateListingVideoScript } from "@/lib/engines/video.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/videos")({
  head: () => ({ meta: [{ title: "Videos — PropAI Voice & Video" }] }),
  component: VideosPage,
});

type Script = {
  title: string;
  hook: string;
  scenes: { seconds: number; voiceover: string; visual_direction: string }[];
  cta: string;
};

function VideosPage() {
  const gen = useServerFn(generateListingVideoScript);
  const [address, setAddress] = useState("123 Maple St, Newark NJ");
  const [highlights, setHighlights] = useState("3BR/2BA · renovated kitchen · 0.25 acre · top-rated school district");
  const [style, setStyle] = useState<"luxury" | "investor" | "first_time_buyer" | "rental">("luxury");
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  async function run() {
    setLoading(true); setScript(null); setAudioUrl(null);
    try {
      const res = await gen({ data: { address, highlights, style, length_seconds: 45 } });
      setScript(res as Script);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  async function speak() {
    if (!script) return;
    setTtsLoading(true);
    try {
      const fullText = [script.hook, ...script.scenes.map((s) => s.voiceover), script.cta].join(" ");
      const res = await fetch("/api/engines/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: fullText, voice: "alloy" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) { toast.error(e instanceof Error ? e.message : "TTS failed"); }
    finally { setTtsLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Voice &amp; Video Engine</div>
        <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">AI tour <span className="h-italic">videos</span></h1>
        <p className="text-[var(--w55)] mt-3 max-w-xl">Script a 45-second listing walkthrough, then generate a voiceover.</p>
      </div>

      <div className="surface p-6 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--w55)]">Address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[var(--w55)]">Audience</label>
            <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="luxury">Luxury buyer</SelectItem>
                <SelectItem value="investor">Investor</SelectItem>
                <SelectItem value="first_time_buyer">First-time buyer</SelectItem>
                <SelectItem value="rental">Rental tenant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--w55)]">Highlights</label>
          <Textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
        </div>
        <Button onClick={run} disabled={loading}>{loading ? "Writing script…" : "Generate script"}</Button>
      </div>

      {script && (
        <div className="surface p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="h-display text-2xl">{script.title}</h2>
            <Button onClick={speak} disabled={ttsLoading} variant="outline">
              {ttsLoading ? "Synthesizing…" : "🎙️ Generate voiceover"}
            </Button>
          </div>
          <p className="text-[var(--w85)] italic">{script.hook}</p>
          <ol className="space-y-2">
            {script.scenes.map((s, i) => (
              <li key={i} className="border-l-2 border-border pl-3">
                <div className="text-xs text-[var(--w55)]">Scene {i + 1} · {s.seconds}s</div>
                <div className="text-sm">{s.voiceover}</div>
                <div className="text-xs text-[var(--w45)] mt-1">📷 {s.visual_direction}</div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-[var(--w85)] font-semibold">{script.cta}</p>
          {audioUrl && <audio controls src={audioUrl} className="w-full mt-2" />}
        </div>
      )}
    </div>
  );
}
