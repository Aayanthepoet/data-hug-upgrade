import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/ainetworkagency-logo.png.asset.json";

export function SiteFooter() {
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
            The complete intelligence platform for real estate professionals. Built by AI Network Agency.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--w35)] mb-4">Platform</div>
          <ul className="space-y-2 text-[var(--w65)]">
            <li><Link to="/features" className="hover:text-white">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link to="/auth" className="hover:text-white">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--w35)] mb-4">Company</div>
          <ul className="space-y-2 text-[var(--w65)]">
            <li><a href="/#contact" className="hover:text-white">Contact</a></li>
            <li><a href="mailto:hello@propai.io" className="hover:text-white">hello@propai.io</a></li>
            <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-white">Terms &amp; Conditions</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-x py-6 flex items-center justify-between text-xs text-[var(--w35)]">
          <div>© {new Date().getFullYear()} AI Network Agency. All rights reserved.</div>
          <div>PropAI Platform · v1.0</div>
        </div>
      </div>
    </footer>
  );
}
