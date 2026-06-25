import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import logoAsset from "@/assets/ainetworkagency-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[rgba(6,10,18,.7)] border-b border-border">
      <div className="container-x flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3 font-bold text-lg tracking-tight">
          <img src={logoAsset.url} alt="AI Network Agency Logo" className="h-8 w-auto rounded bg-white p-1" />
          <span className="border-l border-border pl-3 text-sm font-medium tracking-normal text-[var(--w65)]">
            Prop<span className="text-cyan">AI</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-[var(--w65)]">
          <Link to="/features" className="hover:text-white transition">{t("nav.features")}</Link>
          <Link to="/pricing" className="hover:text-white transition">{t("nav.pricing")}</Link>
          <a href="/#workflow" className="hover:text-white transition">{t("nav.howItWorks")}</a>
          <a href="/#contact" className="hover:text-white transition">{t("nav.contact")}</a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          {!loading && user ? (
            <Link to="/app" className="btn-primary text-xs px-4 py-2 whitespace-nowrap">{t("common.openDashboard")}</Link>
          ) : (
            <>
              <Link to="/auth" className="text-sm text-[var(--w75)] hover:text-white hidden sm:inline">{t("common.signIn")}</Link>
              <Link to="/auth" search={{ mode: "signup" } as never} className="btn-primary text-xs px-4 py-2 whitespace-nowrap">{t("common.startTrial")}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
