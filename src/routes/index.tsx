import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { LeadForm } from "@/components/site/LeadForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PropAI — The Complete Intelligence Platform for Real Estate" },
      { name: "description", content: "AI-powered owner search, skip tracing, outreach, property redesign, auctions, and video marketing. Built for real estate professionals by AI Network Agency." },
      { property: "og:title", content: "PropAI — Intelligence Platform for Real Estate" },
      { property: "og:description", content: "Find hidden sellers, automate outreach, redesign properties, run auctions, close more deals — one AI platform." },
    ],
  }),
  component: Index,
});

const modules = [
  { num: "01", icon: "🔍", title: "AI Owner Search", desc: "Query nationwide property records in seconds. Find owners by address, ZIP, equity, distress signal, or absentee status.", color: "var(--cyan)", powered: "PropAI Search Intelligence" },
  { num: "02", icon: "👤", title: "Contact Resolver", desc: "Skip-trace phone, email, and social profiles for 94% of US property owners. Verified, deliverable, fast.", color: "var(--gold)", powered: "PropAI Contact Resolver" },
  { num: "03", icon: "🧠", title: "AI Lead Scoring", desc: "Motivation score 0–100 from equity position, days in distress, ownership history, and situation type.", color: "var(--violet)", powered: "PropAI Language Engine" },
  { num: "04", icon: "📨", title: "Outreach Engine", desc: "Personalized seller letters in your voice. 68% open rate vs 22% industry standard. Launch in one click.", color: "var(--green)", powered: "PropAI Outreach Engine" },
  { num: "05", icon: "✨", title: "Vision Studio", desc: "Photorealistic AI property redesigns in 6 styles, under 60 seconds. HD and 4K output included.", color: "var(--cyan)", powered: "PropAI Vision Studio" },
  { num: "06", icon: "🎬", title: "Video AI Generator", desc: "Professional tour videos with AI voiceover and brand kit auto-applied — optimized for YouTube, Reels, TikTok.", color: "var(--red)", powered: "PropAI Video Studio" },
];

const stats = [
  { n: "2,400+", l: "Active agents" },
  { n: "18,000+", l: "Deals facilitated" },
  { n: "94%", l: "Skip-trace accuracy" },
  { n: "68%", l: "Avg outreach open rate" },
];

const workflow = [
  { n: 1, t: "Find the Owner", d: "PropAI's Search Intelligence queries nationwide property records.", tag: "Search Intelligence" },
  { n: 2, t: "Skip-Trace Contact Info", d: "Contact Resolver traces phone, email, social from 94% of US owners.", tag: "Contact Resolver" },
  { n: 3, t: "Score the Lead", d: "Language Engine scores motivation 0–100 from equity, distress, history.", tag: "Language Engine" },
  { n: 4, t: "Send AI-Personalized Outreach", d: "Outreach Engine writes a letter specific to this owner's situation.", tag: "Outreach Engine" },
  { n: 5, t: "Present with AI Visuals", d: "Vision Studio renders redesigns. Video Studio creates the tour video.", tag: "Vision + Video Studio" },
  { n: 6, t: "Close the Deal", d: "PropAI Agent coaches negotiation and tracks every touchpoint.", tag: "PropAI Agent" },
];

function Index() {
  return (
    <>
      <SiteHeader />

      {/* HERO */}
      <section className="grid-bg pt-32 pb-24 relative overflow-hidden">
        <div className="absolute -top-48 -right-32 w-[700px] h-[700px] rounded-full pointer-events-none"
             style={{ background: "radial-gradient(circle, rgba(0,200,255,.10), transparent 65%)" }} />
        <div className="container-x grid lg:grid-cols-[1fr_540px] gap-16 items-center relative">
          <div>
            <div className="eyebrow fu"><span className="eyebrow-dot" />AI Network Agency · PropAI Platform</div>
            <h1 className="h-display text-[clamp(48px,6vw,88px)] mt-7 fu fu-1">
              The Complete<br />
              <span className="text-cyan">Intelligence</span><br />
              <span className="h-italic text-[0.72em]">Platform for Real Estate</span>
            </h1>
            <p className="mt-7 text-[18px] leading-[1.78] text-[var(--w55)] max-w-[520px] font-light fu fu-2">
              PropAI transforms your real estate office into an AI-powered deal machine. Find hidden sellers, automate outreach, redesign properties, and close more deals — all inside one platform built by AI Network Agency.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3 fu fu-3">
              <Link to="/auth" search={{ mode: "signup" } as never} className="btn-primary text-base px-7 py-4">
                Start Free 14-Day Trial
              </Link>
              <Link to="/features" className="btn-ghost text-base px-6 py-4">Explore Platform →</Link>
            </div>
            <div className="mt-12 pt-8 border-t border-border flex flex-wrap items-center gap-4 fu fu-4">
              <div className="flex">
                {["JM","SR","MC","DK","LR"].map((i, idx) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-[var(--bg)] flex items-center justify-center text-[10px] font-bold ${idx > 0 ? "-ml-2" : ""}`}
                       style={{ background: `linear-gradient(135deg, ${["#00C8FF","#FFB800","#9B87F5","#00D68F","#FF4D6A"][idx]}, #091526)` }}>
                    {i}
                  </div>
                ))}
              </div>
              <div className="w-px h-6 bg-border" />
              <div>
                <div className="text-xs tracking-widest text-gold">★★★★★</div>
                <div className="text-xs text-[var(--w45)]"><span className="text-white font-semibold">2,400+ agents</span> across 47 states</div>
              </div>
              <div className="w-px h-6 bg-border hidden sm:block" />
              <div className="text-xs text-[var(--w45)]"><span className="text-white font-semibold">18,000+</span> deals facilitated</div>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="fu fu-2 surface p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-[var(--s1)]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="text-[11px] text-[var(--w35)] flex-1 text-center font-mono">app.propai.io</div>
            </div>
            <div className="grid grid-cols-[140px_1fr]">
              <div className="border-r border-border p-3 space-y-1 bg-[rgba(0,0,0,.15)]">
                <div className="font-bold text-sm mb-3">Prop<span className="text-cyan">AI</span></div>
                {[
                  ["⊞","Dashboard", true],["🔍","Owner Finder"],["📨","Outreach"],
                  ["🏠","Listings"],["✨","Redesign"],["🔨","Auctions"],["🎬","Video"],["🤖","Agent"],
                ].map(([ic, n, on]) => (
                  <div key={n as string} className={`flex items-center gap-2 text-[11px] px-2 py-1.5 rounded ${on ? "bg-cyan-d text-cyan" : "text-[var(--w55)]"}`}>
                    <span>{ic}</span>{n}
                  </div>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[["247","Leads","white"],["8","Closed","var(--gold)"],["34","Listings","white"],["68%","Open","var(--cyan)"]].map(([v,l,c]) => (
                    <div key={l} className="bg-[var(--s1)] border border-border rounded p-2.5">
                      <div className="text-lg font-bold" style={{ color: c }}>{v}</div>
                      <div className="text-[10px] text-[var(--w35)] uppercase tracking-wider">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-[var(--s1)] border border-border rounded p-3">
                  <div className="text-[10px] text-cyan font-bold uppercase tracking-wider mb-2">PropAI Scored Leads</div>
                  {[["J. Morrison · 142 Oak St","94","var(--cyan)"],["S. Rivera · 78 Maple","87","var(--cyan)"],["M. Chang · 3901 Pine","72","var(--gold)"],["L. Parker · 2201 Birch","65","var(--gold)"]].map(([n,s,c]) => (
                    <div key={n} className="flex items-center justify-between py-1.5 text-[11px] border-b border-border last:border-0">
                      <span className="text-[var(--w65)]">{n}</span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded text-[10px]" style={{ color: c, background: `${c}1a` }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="container-x">
        <div className="surface grid grid-cols-2 md:grid-cols-4 overflow-hidden">
          {stats.map(s => (
            <div key={s.l} className="text-center p-8 border-r border-border last:border-r-0">
              <div className="h-display text-[44px] text-cyan">{s.n}</div>
              <div className="text-xs uppercase tracking-widest text-[var(--w45)] mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="container-x mt-32">
        <div className="text-center mb-16">
          <div className="eyebrow"><span className="eyebrow-dot" />Platform Modules</div>
          <h2 className="h-display text-[clamp(36px,5vw,64px)] mt-6">
            Seven AI engines. <span className="h-italic">One platform.</span>
          </h2>
          <p className="text-[var(--w55)] mt-5 max-w-2xl mx-auto leading-relaxed">
            The same capabilities institutional investors pay $50,000+/yr for — bundled, integrated, and purpose-built for real estate professionals.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map(m => (
            <div key={m.num} className="surface surface-hover p-7" style={{ background: `linear-gradient(160deg, ${m.color}0d, var(--s2))` }}>
              <div className="text-[10px] tracking-widest text-[var(--w35)] font-mono">MODULE {m.num}</div>
              <div className="text-4xl mt-4">{m.icon}</div>
              <div className="mt-5 text-lg font-bold">{m.title}</div>
              <p className="mt-2 text-sm text-[var(--w55)] leading-relaxed">{m.desc}</p>
              <div className="mt-5 text-[10px] uppercase tracking-widest font-semibold" style={{ color: m.color }}>{m.powered}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10 flex justify-center gap-3 flex-wrap">
          <Link to="/features" className="btn-ghost">See all features →</Link>
          <Link to="/auth" search={{ mode: "signup" } as never} className="btn-primary">Start Free 14-Day Trial</Link>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="container-x mt-32">
        <div className="text-center mb-16">
          <div className="eyebrow"><span className="eyebrow-dot" />End-to-End Process</div>
          <h2 className="h-display text-[clamp(36px,5vw,64px)] mt-6">
            Unknown owner to <span className="h-italic">closed deal</span> — one platform
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflow.map(w => (
            <div key={w.n} className="surface p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-d border border-[var(--cyan-b)] flex items-center justify-center font-bold text-cyan">{w.n}</div>
                <div>
                  <div className="font-semibold">{w.t}</div>
                  <p className="text-sm text-[var(--w55)] mt-1.5 leading-relaxed">{w.d}</p>
                  <div className="mt-3 text-[10px] uppercase tracking-widest text-cyan font-semibold">{w.tag}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="container-x mt-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" />Get started</div>
            <h2 className="h-display text-[clamp(36px,5vw,56px)] mt-6">
              Ready to see PropAI <span className="h-italic">in your market?</span>
            </h2>
            <p className="text-[var(--w55)] mt-5 leading-relaxed max-w-md">
              Tell us about your brokerage. We'll set up a personalized walkthrough and run a real owner search in your target ZIP — live, on the call.
            </p>
            <div className="mt-8 space-y-3 text-sm text-[var(--w65)]">
              <div className="flex items-center gap-3"><span className="text-cyan">✓</span> 14-day free trial, no credit card</div>
              <div className="flex items-center gap-3"><span className="text-cyan">✓</span> Full platform access during trial</div>
              <div className="flex items-center gap-3"><span className="text-cyan">✓</span> Personal onboarding specialist</div>
            </div>
          </div>
          <LeadForm source="landing-contact" />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
