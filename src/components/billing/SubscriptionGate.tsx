import { ReactNode, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { getMySubscription, reconcileMySubscription } from "@/lib/stripe/billing.functions";

/**
 * Wrap protected children. Admins always pass. Otherwise an active subscription is required.
 * On mount, reconciles the Supabase subscription row against Stripe (source of truth)
 * so a just-completed checkout is reflected even if the webhook hasn't landed yet.
 * Redirects to /billing when blocked.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const reconciledRef = useRef(false);

  const q = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => getMySubscription(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (reconciledRef.current) return;
    reconciledRef.current = true;
    reconcileMySubscription()
      .then(() => qc.invalidateQueries({ queryKey: ["my-subscription"] }))
      .catch(() => {
        // best-effort; gate still works off the existing row
      });
  }, [qc]);

  if (q.isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-[var(--w55)]">
        Loading workspace…
      </div>
    );
  }
  if (q.isError || !q.data?.hasAccess) {
    return <Navigate to="/billing" replace />;
  }
  return <>{children}</>;
}
