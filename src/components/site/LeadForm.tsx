import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email("Invalid email").max(255),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
});

export function LeadForm({ source = "landing" }: { source?: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      company: fd.get("company") || undefined,
      message: fd.get("message") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your inputs");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("leads").insert({ ...parsed.data, source });
    setLoading(false);
    if (error) {
      toast.error("Couldn't submit. Try again.");
      return;
    }
    setDone(true);
    toast.success("Thanks! We'll be in touch within 24 hours.");
  }

  if (done) {
    return (
      <div className="surface p-8 text-center">
        <div className="text-cyan text-3xl mb-2">✓</div>
        <div className="font-semibold">You're on the list.</div>
        <div className="text-sm text-[var(--w55)] mt-1">A specialist will reach out within 24 hours.</div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="surface p-7 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <input name="full_name" required placeholder="Full name" className="bg-[var(--s1)] border border-border rounded-md px-4 py-3 text-sm w-full focus:outline-none focus:border-cyan" />
        <input name="email" type="email" required placeholder="Work email" className="bg-[var(--s1)] border border-border rounded-md px-4 py-3 text-sm w-full focus:outline-none focus:border-cyan" />
      </div>
      <input name="company" placeholder="Brokerage / company (optional)" className="bg-[var(--s1)] border border-border rounded-md px-4 py-3 text-sm w-full focus:outline-none focus:border-cyan" />
      <textarea name="message" rows={3} placeholder="What are you hoping PropAI can do for you?" className="bg-[var(--s1)] border border-border rounded-md px-4 py-3 text-sm w-full focus:outline-none focus:border-cyan resize-none" />
      <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? "Sending…" : "Request a demo →"}
      </button>
      <p className="text-[11px] text-[var(--w35)] text-center">No credit card. We respond within 24 hours.</p>
    </form>
  );
}
