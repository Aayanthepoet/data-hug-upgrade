import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { getMySubscription } from "@/lib/stripe/billing.functions";

/**
 * Wrap protected children. Admins always pass. Otherwise an active subscription is required.
 * Redirects to /billing when blocked.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const q = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => getMySubscription(),
    staleTime: 30_000,
  });

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
