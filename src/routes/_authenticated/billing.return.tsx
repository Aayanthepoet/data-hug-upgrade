import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCheckoutSessionStatus } from "@/lib/stripe/billing.functions";

type Search = { session_id?: string };

export const Route = createFileRoute("/_authenticated/billing/return")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Subscription confirmed — PropAI" }] }),
  component: BillingReturn,
});

function BillingReturn() {
  const { session_id } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<{ status: string | null; email: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session_id) {
      setError("Missing session id.");
      return;
    }
    getCheckoutSessionStatus({ data: { sessionId: session_id } })
      .then((r) => setState({ status: r.status ?? null, email: r.customerEmail }))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not confirm session"));
  }, [session_id]);

  return (
    <div className="max-w-xl mx-auto surface p-8 text-center space-y-5">
      <h1 className="h-display text-3xl">
        {state?.status === "complete" ? "You're in 🎉" : error ? "Something went wrong" : "Confirming…"}
      </h1>
      <p className="text-sm text-[var(--w55)]">
        {state?.status === "complete"
          ? `Welcome to PropAI Pro${state.email ? `, ${state.email}` : ""}. Your subscription is active.`
          : error ?? "Hang tight while we confirm your subscription."}
      </p>
      <div className="flex justify-center gap-2">
        <button onClick={() => navigate({ to: "/app" })} className="btn-primary px-5 py-2.5">
          Open workspace
        </button>
        <Link to="/billing" className="btn-ghost px-5 py-2.5">Back to billing</Link>
      </div>
    </div>
  );
}
