import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import logoAsset from "@/assets/ainetworkagency-logo.png.asset.json";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border mt-32">
      <div className="container-x py-16 grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
        <div className="col-span-2">
          <div className="flex items-center gap-3 font-bold text-lg mb-4">
            <img src={logoAsset.url} alt="AI Network Agency Logo" className="h-8 w-auto rounded bg-white p-1" />
            <span className="border-l border-border pl-3 text-sm font-medium tracking-normal text-[var(--w65)]">
              Prop<span className="text-cyan">AI</span>
            </span>
          </div>
          <p className="mt-3 text-[var(--w45)] max-w-xs leading-relaxed">
            {t("footer.tagline")}
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--w35)] mb-4">{t("footer.platform")}</div>
          <ul className="space-y-2 text-[var(--w65)]">
            <li><Link to="/features" className="hover:text-white">{t("nav.features")}</Link></li>
            <li><Link to="/pricing" className="hover:text-white">{t("nav.pricing")}</Link></li>
            <li><Link to="/auth" className="hover:text-white">{t("common.signIn")}</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--w35)] mb-4">{t("footer.company")}</div>
          <ul className="space-y-2 text-[var(--w65)]">
            <li><a href="/#contact" className="hover:text-white">{t("nav.contact")}</a></li>
            <li><a href="mailto:hello@propai.io" className="hover:text-white">hello@propai.io</a></li>
            <li><Link to="/privacy" className="hover:text-white">{t("footer.privacy")}</Link></li>
            <li><Link to="/terms" className="hover:text-white">{t("footer.terms")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-x py-6 flex items-center justify-between text-xs text-[var(--w35)]">
          <div>© {new Date().getFullYear()} AI Network Agency. {t("footer.rights")}</div>
          <div>PropAI Platform · v1.0</div>
        </div>
      </div>
    </footer>
  );
}
