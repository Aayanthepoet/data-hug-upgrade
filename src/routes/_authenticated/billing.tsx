import { createFileRoute, Link, useNavigate, useServerFn } from "@tanstack/react-router";
// useServerFn lives in @tanstack/react-start, but createFileRoute is from react-router.
// Re-import properly below.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadStripe, type Stripe as StripeJS } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import {
  createEmbeddedCheckoutSession,
  createPortalSession,
  getMySubscription,
  getStripePublishableKey,
} from "@/lib/stripe/billing.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — PropAI" }] }),
  component: BillingPage,
});

function BillingPage() {
  const navigate = useNavigate();
  const subQ = useQuery({ queryKey: ["my-subscription"], queryFn: () => getMySubscription() });
  const pkQ = useQuery({ queryKey: ["stripe-pk"], queryFn: () => getStripePublishableKey() });

  const stripePromise = useMemo<Promise<StripeJS | null> | null>(() => {
    const pk = pkQ.data?.publishableKey;
    return pk ? loadStripe(pk) : null;
  }, [pkQ.data?.publishableKey]);

  const [starting, setStarting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  async function startCheckout() {
    setStarting(true);
    try {
      const res = await createEmbeddedCheckoutSession();
      if (!res.clientSecret) throw new Error("Stripe did not return a client secret");
      setClientSecret(res.clientSecret);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
    } finally {
      setStarting(false);
    }
  }

  async function openPortal() {
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
    }
  }

  const sub = subQ.data?.subscription;
  const isAdmin = subQ.data?.isAdmin;
  const hasAccess = subQ.data?.hasAccess;
  const activeStatuses = ["active", "trialing", "past_due"];
  const subActive = !!sub && activeStatuses.includes(sub.status ?? "");

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="h-display text-3xl">Billing</h1>
        <p className="text-sm text-[var(--w55)] mt-2">
          PropAI Pro — full access to lead intelligence, AI outreach, Vision Studio, and more.
        </p>
      </div>

      {subQ.isLoading ? (
        <div className="surface p-6 text-sm text-[var(--w55)]">Loading…</div>
      ) : (
        <div className="surface p-6 space-y-3">
          <div className="text-xs uppercase tracking-widest text-[var(--w35)]">Your plan</div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold">
                {subActive ? "PropAI Pro" : isAdmin ? "Admin (complimentary access)" : "No active subscription"}
              </div>
              <div className="text-xs text-[var(--w55)] mt-1">
                {sub?.status ? `Status: ${sub.status}` : "Subscribe to unlock the workspace."}
                {sub?.current_period_end
                  ? ` · Renews ${new Date(sub.current_period_end).toLocaleDateString()}`
                  : ""}
                {sub?.cancel_at_period_end ? " · Cancels at period end" : ""}
              </div>
            </div>
            <div className="flex gap-2">
              {hasAccess && (
                <button onClick={() => navigate({ to: "/app" })} className="btn-ghost text-sm px-4 py-2">
                  Go to workspace
                </button>
              )}
              {sub?.stripe_customer_id && (
                <button onClick={openPortal} className="btn-ghost text-sm px-4 py-2">
                  Manage billing
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!subActive && (
        <div className="surface p-6">
          {!clientSecret ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-lg font-semibold">Subscribe to PropAI Pro</div>
                <div className="text-xs text-[var(--w55)] mt-1">
                  Embedded secure checkout powered by Stripe. Cancel anytime.
                </div>
              </div>
              <button onClick={startCheckout} disabled={starting || !pkQ.data?.publishableKey} className="btn-primary px-5 py-2.5 disabled:opacity-60">
                {starting ? "Loading…" : "Subscribe"}
              </button>
            </div>
          ) : stripePromise ? (
            <div id="checkout">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <div className="text-sm text-[var(--w55)]">Stripe is not configured.</div>
          )}
        </div>
      )}

      <div className="text-xs text-[var(--w35)]">
        <Link to="/" className="hover:text-cyan">← Back to landing page</Link>
      </div>
    </div>
  );
}
