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
            <Select value={task} onValueChange={(v) => { setTask(v as Task); if (v !== "outreach_sms") setSmsAck(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outreach_letter">Seller letter (direct mail) — recommended</SelectItem>
                <SelectItem value="outreach_email">Email + subject — recommended</SelectItem>
                <SelectItem value="negotiation_reply">Negotiation reply</SelectItem>
                <SelectItem value="listing_description">Listing description</SelectItem>
                <SelectItem value="cma_summary">CMA summary</SelectItem>
                <SelectItem value="outreach_sms">SMS — consent required (TCPA)</SelectItem>
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
        {isSms && (
          <div className="border border-amber-500/40 bg-amber-500/10 rounded-md p-3 space-y-2 text-xs text-amber-100">
            <div className="font-semibold uppercase tracking-wider text-amber-300">⚠ TCPA / cold-SMS warning</div>
            <p className="opacity-90">
              Property owners surfaced in PropAI have <strong>not</strong> opted in to receive text messages from you. Sending
              cold SMS to non-consenting recipients can violate the TCPA, state mini-TCPA statutes, and carrier policy, and
              may result in fines, account suspension, or litigation. PropAI does not represent owner phone numbers as a
              consented SMS channel.
            </p>
            <p className="opacity-90">
              Recommended channels for owner outreach: <strong>seller letters (direct mail)</strong> and <strong>email</strong>.
              Only use SMS where you have collected and can prove prior express written consent from the recipient.
            </p>
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={smsAck}
                onChange={(e) => setSmsAck(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm I have prior express written consent from each recipient and I am solely responsible for TCPA,
                state, and carrier compliance for any SMS I send.
              </span>
            </label>
          </div>
        )}
        <Button onClick={run} disabled={loading || blocked} title={blocked ? "Acknowledge the TCPA consent requirement to enable SMS" : undefined}>
          {loading ? "Composing…" : blocked ? "Acknowledge consent to generate SMS" : "Generate 3 variations"}
        </Button>
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
