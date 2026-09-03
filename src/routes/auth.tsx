import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Search = { mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — PropAI" },
      { name: "description", content: "Sign in or create your PropAI account." },
    ],
  }),
  component: AuthPage,
});

const SMS_CONSENT_TEXT =
  "I agree to receive SMS notifications from PropAI related to my account, property alerts, and service updates. Message & data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const isSignup = mode === "signup";
  const [loading, setLoading] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const schema = z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(8, "Password must be at least 8 characters").max(128),
      full_name: isSignup ? z.string().trim().min(1).max(120) : z.string().optional(),
    });
    const parsed = schema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      full_name: fd.get("full_name") ?? "",
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }
    setLoading(true);
    if (isSignup) {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { full_name: parsed.data.full_name, sms_consent: smsConsent },
        },
      });
      if (error) { setLoading(false); toast.error(error.message); return; }
      if (smsConsent && signUpData.user?.id) {
        try {
          await supabase.from("sms_consents").insert({
            user_id: signUpData.user.id,
            consent_text: SMS_CONSENT_TEXT,
            source: "signup",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          });
        } catch {
          // non-blocking; consent record best-effort
        }
      }
      setLoading(false);
      toast.success("Account created!");
      navigate({ to: "/app" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email, password: parsed.data.password,
      });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/app" });
    }
  }



  return (
    <div className="min-h-screen flex grid-bg">
      <div className="hidden lg:flex flex-col justify-between p-12 w-[480px] border-r border-border relative">
        <Link to="/" className="font-bold text-xl">Prop<span className="text-cyan">AI</span></Link>
        <div>
          <h2 className="h-display text-4xl">
            The AI operating <span className="h-italic">system for real estate.</span>
          </h2>
          <p className="text-[var(--w55)] mt-6 leading-relaxed text-sm">
            Find hidden sellers, run AI-personalized outreach, and manage your pipeline — all in one workspace.
          </p>
          <div className="mt-8 text-xs text-[var(--w45)]">
            7-day free trial · No credit card required · Cancel anytime · Built by AI Network Agency
          </div>

        </div>
        <div className="text-xs text-[var(--w35)]">© AI Network Agency</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Link to="/" className="font-bold text-xl">Prop<span className="text-cyan">AI</span></Link></div>
          <h1 className="h-display text-3xl">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-[var(--w55)] mt-2">
            {isSignup ? "Start your free 7-day trial. No credit card required · Cancel anytime." : "Sign in to your PropAI dashboard."}
          </p>


          <form onSubmit={onSubmit} className="space-y-3">
            {isSignup && (
              <input name="full_name" required placeholder="Full name"
                     className="bg-[var(--s1)] border border-border rounded-md px-4 py-3 text-sm w-full focus:outline-none focus:border-cyan" />
            )}
            <input name="email" type="email" required placeholder="Work email"
                   className="bg-[var(--s1)] border border-border rounded-md px-4 py-3 text-sm w-full focus:outline-none focus:border-cyan" />
            <input name="password" type="password" required placeholder="Password (min 8 chars)" minLength={8}
                   className="bg-[var(--s1)] border border-border rounded-md px-4 py-3 text-sm w-full focus:outline-none focus:border-cyan" />
            {isSignup && (
              <label className="flex items-start gap-2 text-xs text-[var(--w55)] leading-relaxed pt-1">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="mt-0.5 accent-cyan"
                />
                <span>
                  I agree to receive SMS notifications from PropAI related to my account, property alerts, and service updates. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase. See our{" "}
                  <Link to="/terms" className="text-cyan hover:underline">Terms</Link> and{" "}
                  <Link to="/privacy" className="text-cyan hover:underline">Privacy Policy</Link>.
                </span>
              </label>
            )}
            <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </button>

          </form>

          <p className="mt-6 text-sm text-[var(--w55)] text-center">
            {isSignup ? (
              <>Already have an account? <Link to="/auth" search={{ mode: "signin" }} className="text-cyan hover:underline">Sign in</Link></>
            ) : (
              <>New to PropAI? <Link to="/auth" search={{ mode: "signup" }} className="text-cyan hover:underline">Create account</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
