import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — PropAI Platform" },
      { name: "description", content: "Seven AI engines powering owner search, skip tracing, lead scoring, outreach, property redesign, video marketing, and live auctions." },
      { property: "og:title", content: "PropAI Features — Seven AI engines for real estate" },
      { property: "og:description", content: "AI-powered owner search, skip tracing, outreach, vision studio, video studio, and auctions." },
    ],
  }),
  component: Features,
});

const engines = [
  { icon: "🧠", name: "PropAI Language Engine", role: "Outreach, descriptions, CMA, negotiation", badge: "Core AI", color: "var(--cyan)" },
  { icon: "🗺️", name: "Property Intelligence", role: "Owner records, equity data, lien status", badge: "Data Layer", color: "var(--gold)" },
  { icon: "👤", name: "Contact Resolver", role: "Phone, email, social skip tracing", badge: "Skip Trace", color: "var(--violet)" },
  { icon: "👁️", name: "Vision Studio", role: "Property redesign, room detection, upscaling", badge: "Image AI", color: "var(--cyan)" },
  { icon: "🎙️", name: "Voice & Video", role: "AI voiceover, video assembly, brand overlay", badge: "Video AI", color: "var(--red)" },
  { icon: "⚡", name: "Live Engine", role: "Real-time auction bidding, fraud detection", badge: "Real-time", color: "var(--green)" },
  { icon: "🤖", name: "PropAI Agent", role: "Conversational AI assistant with full account context", badge: "AI Agent", color: "var(--violet)" },
];

function Features() {
  return (
    <>
      <SiteHeader />
      <section className="container-x pt-32 pb-12 grid-bg">
        <div className="max-w-3xl">
          <div className="eyebrow"><span className="eyebrow-dot" />What Makes PropAI Different</div>
          <h1 className="h-display text-[clamp(44px,6vw,80px)] mt-6">
            Seven AI engines.<br /><span className="h-italic">One platform.</span>
          </h1>
          <p className="text-[var(--w55)] mt-6 text-lg leading-relaxed">
            PropAI bundles the same AI capabilities that institutional investors pay $50,000+ per year for — seamlessly integrated and purpose-built for real estate professionals.
          </p>
        </div>
      </section>

      <section className="container-x mt-16">
        <div className="grid md:grid-cols-2 gap-4">
          {engines.map(e => (
            <div key={e.name} className="surface surface-hover p-7 flex items-start gap-5"
                 style={{ background: `linear-gradient(160deg, ${e.color}0d, var(--s2))` }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                   style={{ background: `${e.color}1a`, border: `1px solid ${e.color}33` }}>
                {e.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-lg">{e.name}</div>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-1 rounded font-bold"
                        style={{ color: e.color, background: `${e.color}1a` }}>{e.badge}</span>
                </div>
                <p className="text-sm text-[var(--w55)] mt-2">{e.role}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-16">
          <Link to="/auth" search={{ mode: "signup" } as never} className="btn-primary text-base px-7 py-4">
            Start Free 14-Day Trial
          </Link>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
