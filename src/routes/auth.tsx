import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

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


  async function signInGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/app` });
    if (result.error) { setLoading(false); toast.error("Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: "/app" });
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
            7-day free trial · No credit card required · Built by AI Network Agency
          </div>

        </div>
        <div className="text-xs text-[var(--w35)]">© AI Network Agency</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Link to="/" className="font-bold text-xl">Prop<span className="text-cyan">AI</span></Link></div>
          <h1 className="h-display text-3xl">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-[var(--w55)] mt-2">
            {isSignup ? "Start your free 7-day trial. No credit card required." : "Sign in to your PropAI dashboard."}
          </p>

          <button onClick={signInGoogle} disabled={loading}
                  className="mt-7 w-full btn-ghost py-3 disabled:opacity-60">
            <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.6 15.5 18.9 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.1z"/><path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.1c-2 1.4-4.5 2.3-7.2 2.3-5.1 0-9.5-3.3-11.2-7.9l-6.5 5C9.5 38.9 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5h-1.9V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.1c-.4.4 6.7-4.9 6.7-14.8 0-1.2-.1-2.3-.4-3.5z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--w35)]">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

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
