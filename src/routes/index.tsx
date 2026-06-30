import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { LeadForm } from "@/components/site/LeadForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PropAI — The Complete Intelligence Platform for Real Estate" },
      { name: "description", content: "AI-powered owner search, skip tracing, outreach, property redesign, and video marketing. Built for real estate professionals by AI Network Agency." },
      { property: "og:title", content: "PropAI — Intelligence Platform for Real Estate" },
      { property: "og:description", content: "Find hidden sellers, automate outreach, redesign properties, and close more deals — one AI platform." },
    ],
  }),
  component: Index,
});

const moduleKeys = ["01", "02", "03", "04", "05", "06"] as const;
const moduleMeta: Record<(typeof moduleKeys)[number], { icon: string; color: string }> = {
  "01": { icon: "🔍", color: "var(--cyan)" },
  "02": { icon: "👤", color: "var(--gold)" },
  "03": { icon: "🧠", color: "var(--violet)" },
  "04": { icon: "📨", color: "var(--green)" },
  "05": { icon: "✨", color: "var(--cyan)" },
  "06": { icon: "🎬", color: "var(--red)" },
};
const workflowKeys = ["1", "2", "3", "4", "5", "6"] as const;

function Index() {
  const { t } = useTranslation();



  return (
    <>
      <SiteHeader />

      {/* HERO */}
      <section className="grid-bg pt-32 pb-24 relative overflow-hidden">
        <div className="absolute -top-48 -right-32 w-[700px] h-[700px] rounded-full pointer-events-none"
             style={{ background: "radial-gradient(circle, rgba(0,200,255,.10), transparent 65%)" }} />
        <div className="container-x grid lg:grid-cols-[1fr_540px] gap-16 items-center relative">
          <div>
            <div className="eyebrow fu"><span className="eyebrow-dot" />{t("landing.eyebrow")}</div>
            <h1 className="h-display text-[clamp(48px,6vw,88px)] mt-7 fu fu-1">
              {t("landing.heroTitle1")}<br />
              <span className="text-cyan">{t("landing.heroTitle2")}</span><br />
              <span className="h-italic text-[0.72em]">{t("landing.heroTitle3")}</span>
            </h1>
            <p className="mt-7 text-[18px] leading-[1.78] text-[var(--w55)] max-w-[520px] font-light fu fu-2">
              {t("landing.heroBody")}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3 fu fu-3">
              <Link to="/auth" search={{ mode: "signup" } as never} className="btn-primary text-base px-7 py-4">
                {t("common.startTrialLong")}
              </Link>
              <Link to="/features" className="btn-ghost text-base px-6 py-4">{t("common.explorePlatform")}</Link>
            </div>
            <div className="mt-12 pt-8 border-t border-border text-xs text-[var(--w45)] fu fu-4">
              7-day free trial · No credit card required · Built by AI Network Agency
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
                  ["🏠","Listings"],["✨","Redesign"],["🎬","Video"],["🤖","Agent"],
                ].map(([ic, n, on]) => (
                  <div key={n as string} className={`flex items-center gap-2 text-[11px] px-2 py-1.5 rounded ${on ? "bg-cyan-d text-cyan" : "text-[var(--w55)]"}`}>
                    <span>{ic}</span>{n}
                  </div>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[["247","Leads","white"],["8","Closed","var(--gold)"],["34","Listings","white"],["12","Sent","var(--cyan)"]].map(([v,l,c]) => (
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


      {/* MODULES */}
      <section id="modules" className="container-x mt-32">
        <div className="text-center mb-16">
          <div className="eyebrow"><span className="eyebrow-dot" />{t("landing.modulesEyebrow")}</div>
          <h2 className="h-display text-[clamp(36px,5vw,64px)] mt-6">
            {t("landing.modulesTitle1")} <span className="h-italic">{t("landing.modulesTitle2")}</span>
          </h2>
          <p className="text-[var(--w55)] mt-5 max-w-2xl mx-auto leading-relaxed">
            {t("landing.modulesBody")}
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {moduleKeys.map(k => {
            const meta = moduleMeta[k];
            return (
              <div key={k} className="surface surface-hover p-7" style={{ background: `linear-gradient(160deg, ${meta.color}0d, var(--s2))` }}>
                <div className="text-[10px] tracking-widest text-[var(--w35)] font-mono">MODULE {k}</div>
                <div className="text-4xl mt-4">{meta.icon}</div>
                <div className="mt-5 text-lg font-bold">{t(`modules.${k}.title`)}</div>
                <p className="mt-2 text-sm text-[var(--w55)] leading-relaxed">{t(`modules.${k}.desc`)}</p>
                <div className="mt-5 text-[10px] uppercase tracking-widest font-semibold" style={{ color: meta.color }}>{t(`modules.${k}.powered`)}</div>
              </div>
            );
          })}
        </div>
        <div className="text-center mt-10 flex justify-center gap-3 flex-wrap">
          <Link to="/features" className="btn-ghost">{t("common.seeAllFeatures")}</Link>
          <Link to="/auth" search={{ mode: "signup" } as never} className="btn-primary">{t("common.startTrialLong")}</Link>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="container-x mt-32">
        <div className="text-center mb-16">
          <div className="eyebrow"><span className="eyebrow-dot" />{t("landing.workflowEyebrow")}</div>
          <h2 className="h-display text-[clamp(36px,5vw,64px)] mt-6">
            {t("landing.workflowTitle1")} <span className="h-italic">{t("landing.workflowTitle2")}</span> {t("landing.workflowTitle3")}
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflowKeys.map(k => (
            <div key={k} className="surface p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-d border border-[var(--cyan-b)] flex items-center justify-center font-bold text-cyan">{k}</div>
                <div>
                  <div className="font-semibold">{t(`workflow.${k}.t`)}</div>
                  <p className="text-sm text-[var(--w55)] mt-1.5 leading-relaxed">{t(`workflow.${k}.d`)}</p>
                  <div className="mt-3 text-[10px] uppercase tracking-widest text-cyan font-semibold">{t(`workflow.${k}.tag`)}</div>
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
            <div className="eyebrow"><span className="eyebrow-dot" />{t("landing.contactEyebrow")}</div>
            <h2 className="h-display text-[clamp(36px,5vw,56px)] mt-6">
              {t("landing.contactTitle1")} <span className="h-italic">{t("landing.contactTitle2")}</span>
            </h2>
            <p className="text-[var(--w55)] mt-5 leading-relaxed max-w-md">
              {t("landing.contactBody")}
            </p>
            <div className="mt-8 space-y-3 text-sm text-[var(--w65)]">
              <div className="flex items-center gap-3"><span className="text-cyan">✓</span> {t("landing.contactBullet1")}</div>
              <div className="flex items-center gap-3"><span className="text-cyan">✓</span> {t("landing.contactBullet2")}</div>
              <div className="flex items-center gap-3"><span className="text-cyan">✓</span> {t("landing.contactBullet3")}</div>
            </div>
          </div>
          <LeadForm source="landing-contact" />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
