import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PropAI Platform" },
      { name: "description", content: "Simple plans for solo agents, teams, and brokerages. Start with a free 7-day trial. No credit card required." },
      { property: "og:title", content: "PropAI Pricing" },
      { property: "og:description", content: "Plans for solo agents, teams, and brokerages. 7-day free trial." },
      { property: "og:url", content: "https://propai.ainetworkagency.com/pricing" },
      { property: "og:image", content: "https://propai.ainetworkagency.com/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://propai.ainetworkagency.com/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://propai.ainetworkagency.com/pricing" }],
  }),
  component: Pricing,
});

type Tier = {
  name: string;
  tag: string;
  featured?: boolean;
  monthly: number | null;
  annualPerMonth: number | null;
  annualTotal: number | null;
  features: string[];
  cta: string;
};

const tiers: Tier[] = [
  {
    name: "Solo Agent", tag: "For independent agents getting started",
    monthly: 149, annualPerMonth: 119, annualTotal: 1428,
    features: ["500 owner searches / month", "200 skip-traces / month", "AI outreach (unlimited)", "Vision Studio (50 redesigns)", "Email support"],
    cta: "Start free trial",
  },
  {
    name: "Pro Team", tag: "For growing teams and small brokerages", featured: true,
    monthly: 399, annualPerMonth: 319, annualTotal: 3828,
    features: ["Unlimited owner searches", "1,500 skip-traces / month", "Unlimited AI outreach", "Vision Studio (250 redesigns)", "Video AI generator", "Priority support", "Up to 5 seats"],
    cta: "Start free trial",
  },
  {
    name: "Enterprise", tag: "For brokerages and investment funds",
    monthly: null, annualPerMonth: null, annualTotal: null,
    features: ["Everything in Pro Team", "Unlimited skip-traces", "Unlimited everything", "Custom data sources", "API access", "Dedicated CSM", "SSO & SAML", "Unlimited seats"],
    cta: "Contact sales",
  },
];

const faqs = [
  { q: "Do I need a credit card for the trial?", a: "No. The 7-day trial requires no card. At the end of the trial you choose a plan and enter payment only then." },
  { q: "What markets do you cover?", a: "NYC and Philadelphia distress data today, with owner search available through your connected skip-trace provider. More markets are on the roadmap." },
  { q: "What is BYOK skip-tracing?", a: "You connect your own BatchData API key. Your key is encrypted per-user; you pay your provider directly at their rates with no markup from us." },
  { q: "Can I import my own leads?", a: "Yes, CSV import is supported, including Vulcan7 exports." },
  { q: "Can I cancel anytime?", a: "Yes, cancel in one click from your account. No contracts on Solo or Pro Team." },
  { q: "Is my data private?", a: "Yes. Your leads, keys, and pipeline are scoped to your account with row-level security." },
];

function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const isAnnual = billing === "annual";

  return (
    <>
      <SiteHeader />
      <section className="container-x pt-32 pb-12 text-center grid-bg">
        <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Simple pricing</div>
        <h1 className="h-display text-[clamp(44px,6vw,72px)] mt-6">
          Plans that <span className="h-italic">scale with you</span>
        </h1>
        <p className="text-[var(--w55)] mt-5 max-w-xl mx-auto">7-day free trial on every plan. No credit card required. Cancel anytime.</p>

        {/* Billing toggle */}
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="mt-8 inline-flex items-center gap-1 p-1 rounded-full border border-border bg-[var(--s1)]"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!isAnnual}
            onClick={() => setBilling("monthly")}
            className={`px-4 py-2 text-xs font-semibold rounded-full transition-colors ${!isAnnual ? "bg-cyan text-[var(--bg)]" : "text-[var(--w55)] hover:text-white"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isAnnual}
            onClick={() => setBilling("annual")}
            className={`px-4 py-2 text-xs font-semibold rounded-full transition-colors inline-flex items-center gap-2 ${isAnnual ? "bg-cyan text-[var(--bg)]" : "text-[var(--w55)] hover:text-white"}`}
          >
            Annual
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isAnnual ? "bg-[var(--bg)] text-cyan" : "bg-cyan-d text-cyan"}`}>Save 20%</span>
          </button>
        </div>
      </section>

      <section className="container-x mt-12">
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map(t => {
            const displayPrice = t.monthly === null ? null : isAnnual ? t.annualPerMonth : t.monthly;
            return (
              <div key={t.name} className={`surface p-9 flex flex-col relative ${t.featured ? "border-cyan" : ""}`}
                   style={t.featured ? { background: "linear-gradient(160deg, rgba(0,200,255,.06), var(--s2))", boxShadow: "0 0 0 1px rgba(0,200,255,.2), 0 24px 80px rgba(0,200,255,.08)" } : undefined}>
                {t.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan text-[var(--bg)] text-[10px] font-bold tracking-widest uppercase px-4 py-1 rounded-full">Most Popular</div>
                )}
                <div className="text-sm font-semibold text-[var(--w65)]">{t.name}</div>
                <div className="text-xs text-[var(--w35)] mt-1">{t.tag}</div>
                <div className="mt-7 flex items-baseline gap-1 min-h-[64px]">
                  {displayPrice !== null ? (
                    <>
                      <span className="text-cyan text-2xl">$</span>
                      <span className="h-display text-5xl">{displayPrice}</span>
                      <span className="text-xs text-[var(--w35)] ml-1">/month</span>
                    </>
                  ) : (
                    <span className="h-display text-4xl">Custom</span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--w45)] min-h-[16px]">
                  {t.monthly !== null && isAnnual && t.annualTotal !== null ? `billed annually ($${t.annualTotal.toLocaleString()}/yr)` : ""}
                </div>
                <div className="h-px bg-border my-6" />
                <ul className="space-y-2 text-sm text-[var(--w65)] flex-1">
                  {t.features.map(f => (
                    <li key={f} className="flex gap-2"><span className="text-cyan font-bold">✓</span>{f}</li>
                  ))}
                </ul>
                <Link to={t.monthly === null ? "/" : "/auth"} hash={t.monthly === null ? "contact" : undefined} search={t.monthly !== null ? ({ mode: "signup" } as never) : undefined}
                      className={`mt-8 ${t.featured ? "btn-primary" : "btn-ghost"} w-full`}>
                  {t.cta}
                </Link>
                {t.monthly !== null && (
                  <p className="text-[11px] text-[var(--w35)] text-center mt-3">No credit card required · Cancel anytime</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="container-x mt-32 max-w-3xl">
        <div className="text-center mb-10">
          <div className="eyebrow inline-flex"><span className="eyebrow-dot" />FAQ</div>
          <h2 className="h-display text-[clamp(32px,4vw,48px)] mt-6">
            Frequently asked <span className="h-italic">questions</span>
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-semibold hover:text-cyan">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-[var(--w55)] leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <SiteFooter />
    </>
  );
}
