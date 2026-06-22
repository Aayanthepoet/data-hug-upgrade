import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PropAI Platform" },
      { name: "description", content: "Simple plans for solo agents, teams, and brokerages. Start with a free 14-day trial." },
      { property: "og:title", content: "PropAI Pricing" },
      { property: "og:description", content: "Plans for solo agents, teams, and brokerages. 14-day free trial." },
    ],
  }),
  component: Pricing,
});

const tiers = [
  {
    name: "Solo Agent", tag: "For independent agents getting started",
    price: 149, period: "/month",
    features: ["500 owner searches / month", "200 skip-traces / month", "AI outreach (unlimited)", "Vision Studio (50 redesigns)", "Email support"],
    cta: "Start free trial",
  },
  {
    name: "Pro Team", tag: "For growing teams and small brokerages", featured: true,
    price: 399, period: "/month",
    features: ["Unlimited owner searches", "1,500 skip-traces / month", "Unlimited AI outreach", "Vision Studio (250 redesigns)", "Video AI generator", "Priority support", "Up to 5 seats"],
    cta: "Start free trial",
  },
  {
    name: "Enterprise", tag: "For brokerages and investment funds",
    price: null, period: "Custom",
    features: ["Everything in Pro Team", "Unlimited skip-traces", "Unlimited everything", "Custom data sources", "API access", "Dedicated CSM", "SSO & SAML", "Unlimited seats"],
    cta: "Contact sales",
  },
];

function Pricing() {
  return (
    <>
      <SiteHeader />
      <section className="container-x pt-32 pb-12 text-center grid-bg">
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Simple pricing</div>
        <h1 className="h-display text-[clamp(44px,6vw,72px)] mt-6">
          Plans that <span className="h-italic">scale with you</span>
        </h1>
        <p className="text-[var(--w55)] mt-5 max-w-xl mx-auto">14-day free trial on every plan. No credit card required. Cancel anytime.</p>
      </section>

      <section className="container-x mt-16">
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map(t => (
            <div key={t.name} className={`surface p-9 flex flex-col relative ${t.featured ? "border-cyan" : ""}`}
                 style={t.featured ? { background: "linear-gradient(160deg, rgba(0,200,255,.06), var(--s2))", boxShadow: "0 0 0 1px rgba(0,200,255,.2), 0 24px 80px rgba(0,200,255,.08)" } : undefined}>
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan text-[var(--bg)] text-[10px] font-bold tracking-widest uppercase px-4 py-1 rounded-full">Most Popular</div>
              )}
              <div className="text-sm font-semibold text-[var(--w65)]">{t.name}</div>
              <div className="text-xs text-[var(--w35)] mt-1">{t.tag}</div>
              <div className="mt-7 flex items-baseline gap-1">
                {t.price !== null ? (
                  <>
                    <span className="text-cyan text-2xl">$</span>
                    <span className="h-display text-5xl">{t.price}</span>
                    <span className="text-xs text-[var(--w35)] ml-1">{t.period}</span>
                  </>
                ) : (
                  <span className="h-display text-4xl">{t.period}</span>
                )}
              </div>
              <div className="h-px bg-border my-6" />
              <ul className="space-y-2 text-sm text-[var(--w65)] flex-1">
                {t.features.map(f => (
                  <li key={f} className="flex gap-2"><span className="text-cyan font-bold">✓</span>{f}</li>
                ))}
              </ul>
              <Link to={t.price === null ? "/" : "/auth"} hash={t.price === null ? "contact" : undefined} search={t.price !== null ? ({ mode: "signup" } as never) : undefined}
                    className={`mt-8 ${t.featured ? "btn-primary" : "btn-ghost"} w-full`}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
