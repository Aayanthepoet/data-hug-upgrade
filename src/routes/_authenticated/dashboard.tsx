import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PropAI" }] }),
  component: Dashboard,
});

const modules = [
  { icon: "🔍", name: "Owner Finder", desc: "Search nationwide property records", color: "var(--cyan)" },
  { icon: "👤", name: "Contact Resolver", desc: "Skip-trace phone, email, social", color: "var(--gold)" },
  { icon: "🧠", name: "Lead Scoring", desc: "AI motivation score 0–100", color: "var(--violet)" },
  { icon: "📨", name: "Outreach Engine", desc: "AI-personalized seller letters", color: "var(--green)" },
  { icon: "✨", name: "Vision Studio", desc: "Photorealistic property redesigns", color: "var(--cyan)" },
  { icon: "🎬", name: "Video Studio", desc: "AI tour videos with voiceover", color: "var(--red)" },
  { icon: "🔨", name: "Auction Engine", desc: "Live bidding with fraud detection", color: "var(--gold)" },
  { icon: "🤖", name: "PropAI Agent", desc: "Conversational AI with full context", color: "var(--violet)" },
];

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-[rgba(6,10,18,.85)] backdrop-blur sticky top-0 z-40">
        <div className="container-x flex items-center justify-between h-16">
          <Link to="/" className="font-bold text-lg">Prop<span className="text-cyan">AI</span></Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--w55)] hidden sm:inline">{user?.email}</span>
            <button onClick={signOut} className="btn-ghost text-xs px-4 py-2">Sign out</button>
          </div>
        </div>
      </header>

      <main className="container-x pt-12 pb-24">
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Welcome to PropAI</div>
        <h1 className="h-display text-[clamp(36px,5vw,56px)] mt-6">
          Your AI <span className="h-italic">workspace</span>
        </h1>
        <p className="text-[var(--w55)] mt-4 max-w-xl">
          Eight modules, all connected to your data. Modules are being rolled out in phases — pick which one you want first.
        </p>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {modules.map(m => (
            <div key={m.name} className="surface p-6 opacity-70">
              <div className="text-3xl mb-3">{m.icon}</div>
              <div className="font-semibold">{m.name}</div>
              <div className="text-xs text-[var(--w45)] mt-1 leading-relaxed">{m.desc}</div>
              <div className="mt-4 inline-block text-[9px] uppercase tracking-widest px-2 py-1 rounded font-bold"
                   style={{ color: m.color, background: `${m.color}1a` }}>Coming next</div>
            </div>
          ))}
        </div>

        <div className="surface mt-12 p-8">
          <div className="text-xs uppercase tracking-widest text-cyan font-bold">Setup checklist</div>
          <h2 className="text-2xl font-bold mt-2">You're in. What's next?</h2>
          <ol className="mt-6 space-y-3 text-sm text-[var(--w65)]">
            <li className="flex gap-3"><span className="text-cyan font-bold">✓</span> Account created</li>
            <li className="flex gap-3"><span className="text-[var(--w35)] font-bold">○</span> Connect a property data source (Phase 4)</li>
            <li className="flex gap-3"><span className="text-[var(--w35)] font-bold">○</span> Configure brand voice for AI outreach</li>
            <li className="flex gap-3"><span className="text-[var(--w35)] font-bold">○</span> Invite team members</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
