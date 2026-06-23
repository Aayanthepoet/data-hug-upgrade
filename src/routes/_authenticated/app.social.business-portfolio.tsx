import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, ShieldCheck, Clock, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "meta_business_portfolio_v1";

type Status = "none" | "pending" | "verified";

type Portfolio = {
  id: string;
  name: string;
  status: Status;
  connected_at: string;
  verified_at: string | null;
};

export const Route = createFileRoute("/_authenticated/app/social/business-portfolio")({
  head: () => ({ meta: [{ title: "Business Portfolio — PropAI" }] }),
  component: BusinessPortfolioPage,
});

function load(): Portfolio | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Portfolio) : null;
  } catch {
    return null;
  }
}

function save(p: Portfolio | null) {
  if (typeof window === "undefined") return;
  if (p) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  else window.localStorage.removeItem(STORAGE_KEY);
}

function BusinessPortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setPortfolio(load());
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !id.trim()) {
      toast.error("Enter a portfolio name and ID.");
      return;
    }
    const next: Portfolio = {
      id: id.trim(),
      name: name.trim(),
      status: "pending",
      connected_at: new Date().toISOString(),
      verified_at: null,
    };
    save(next);
    setPortfolio(next);
    setName("");
    setId("");
    toast.success("Business portfolio attached. Verification pending.");
  };

  const handleVerify = () => {
    if (!portfolio) return;
    setVerifying(true);
    // Simulated verification — Meta verification usually requires uploading
    // a business document and waiting for review. We mimic the latency.
    setTimeout(() => {
      const next: Portfolio = {
        ...portfolio,
        status: "verified",
        verified_at: new Date().toISOString(),
      };
      save(next);
      setPortfolio(next);
      setVerifying(false);
      toast.success("Portfolio marked as verified (simulated).");
    }, 1200);
  };

  const handleRemove = () => {
    if (!confirm("Detach this business portfolio?")) return;
    save(null);
    setPortfolio(null);
    toast.success("Detached.");
  };

  return (
    <div className="max-w-3xl">
      <Link to="/app/social" className="text-sm text-[var(--w55)] hover:text-white inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Social Amplifier
      </Link>

      <div className="mb-6">
        <h1 className="h-display text-3xl flex items-center gap-2">
          <Building2 className="w-7 h-7 text-cyan" /> Business Portfolio
        </h1>
        <p className="text-[var(--w55)] mt-1">
          Attach a Meta Business Portfolio when you're ready. Required for full data access and publishing on a verified app.
        </p>
      </div>

      {portfolio ? (
        <div className="border border-border rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-[var(--w55)]">Attached portfolio</p>
              <p className="font-semibold text-lg truncate">{portfolio.name}</p>
              <p className="text-xs text-[var(--w55)] font-mono mt-0.5">{portfolio.id}</p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                {portfolio.status === "verified" ? (
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <ShieldCheck className="w-4 h-4" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gold">
                    <Clock className="w-4 h-4" /> Verification pending
                  </span>
                )}
                <span className="text-[var(--w35)]">·</span>
                <span className="text-xs text-[var(--w55)]">
                  Attached {new Date(portfolio.connected_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {portfolio.status !== "verified" && (
                <Button onClick={handleVerify} disabled={verifying} className="btn-primary px-4 py-2 text-sm h-auto">
                  {verifying ? "Verifying…" : "Mark as verified"}
                </Button>
              )}
              <Button onClick={handleRemove} className="btn-ghost px-4 py-2 text-sm h-auto">
                Detach
              </Button>
            </div>
          </div>

          {portfolio.status !== "verified" && (
            <div className="mt-4 p-3 rounded-lg bg-gold/5 border border-gold/30 text-sm text-[var(--w70)]">
              Real verification happens inside Meta Business Manager — upload a business
              document, then return here. The "Mark as verified" button simulates that
              outcome for testing.
              <a
                href="https://business.facebook.com/settings/security"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan hover:underline ml-1"
              >
                Open Business Manager <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl p-5 mb-6 text-sm text-[var(--w55)]">
          No business portfolio attached. You can keep using simulated Pages and IG accounts
          until you're ready to verify.
        </div>
      )}

      <form onSubmit={handleConnect} className="border border-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Attach a portfolio</h2>
          <p className="text-xs text-[var(--w55)] mt-0.5">
            Find your portfolio in Meta Business Manager → Business settings → Business info.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bp-name" className="text-xs">Portfolio name</Label>
            <Input
              id="bp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Andy Spencer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-id" className="text-xs">Business portfolio ID</Label>
            <Input
              id="bp-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="1234567890123456"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" className="btn-primary px-5 py-2 text-sm h-auto">
            {portfolio ? "Replace portfolio" : "Attach portfolio"}
          </Button>
        </div>
      </form>
    </div>
  );
}
