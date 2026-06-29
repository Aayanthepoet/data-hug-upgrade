import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { composeWithLanguageEngine } from "@/lib/engines/language.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — PropAI Outreach Engine" }] }),
  component: CampaignsPage,
});

type Task = "outreach_letter" | "outreach_sms" | "outreach_email" | "negotiation_reply" | "listing_description" | "cma_summary";

function CampaignsPage() {
  const compose = useServerFn(composeWithLanguageEngine);
  const [task, setTask] = useState<Task>("outreach_letter");
  const [tone, setTone] = useState<"warm" | "professional" | "casual" | "urgent">("warm");
  const [smsAck, setSmsAck] = useState(false);
  const [context, setContext] = useState(
    "Owner: Jane Doe\nProperty: 123 Maple St, Newark NJ\nEquity: ~62%\nDistress: 90+ days preforeclosure",
  );
  const [variations, setVariations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const isSms = task === "outreach_sms";
  const blocked = isSms && !smsAck;

  async function run() {
    setLoading(true);
    setVariations([]);
    try {
      const res = await compose({ data: { task, tone, context, variations: 3 } });
      setVariations(res.variations);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Outreach Engine · powered by PropAI Language Engine</div>
        <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">Compose <span className="h-italic">campaigns</span></h1>
        <p className="text-[var(--w55)] mt-3 max-w-xl">Generate seller letters, SMS, emails, and negotiation replies in your voice. Three variations per run.</p>
      </div>

      <div className="surface p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--w55)]">Task</label>
            <Select value={task} onValueChange={(v) => setTask(v as Task)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outreach_letter">Seller letter</SelectItem>
                <SelectItem value="outreach_sms">SMS (160 char)</SelectItem>
                <SelectItem value="outreach_email">Email + subject</SelectItem>
                <SelectItem value="negotiation_reply">Negotiation reply</SelectItem>
                <SelectItem value="listing_description">Listing description</SelectItem>
                <SelectItem value="cma_summary">CMA summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-[var(--w55)]">Tone</label>
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--w55)]">Context (owner, address, equity, distress signal)</label>
          <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={6} />
        </div>
        <Button onClick={run} disabled={loading}>{loading ? "Composing…" : "Generate 3 variations"}</Button>
      </div>

      {variations.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          {variations.map((v, i) => (
            <div key={i} className="surface p-4 whitespace-pre-wrap text-sm text-[var(--w85)]">
              <div className="eyebrow inline-flex mb-2"><span className="eyebrow-dot" />Variation {i + 1}</div>
              {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
