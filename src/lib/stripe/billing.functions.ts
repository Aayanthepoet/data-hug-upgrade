import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the publishable key to the browser (safe — it's public by design). */
export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null };
});

/** Returns the caller's subscription row + a derived `hasAccess` flag (active sub OR admin). */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: sub }, { data: isAdmin }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("status,price_id,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);

    const activeStatuses = ["active", "trialing", "past_due"];
    const subActive = !!sub && activeStatuses.includes(sub.status ?? "");
    return {
      subscription: sub ?? null,
      isAdmin: !!isAdmin,
      hasAccess: !!isAdmin || subActive,
    };
  });

/**
 * Reconcile the caller's Supabase subscription row from Stripe (source of truth).
 * Looks up the customer, fetches the most recent subscription, and upserts the row.
 * Safe to call on /billing and /app loads — short-circuits if no customer exists.
 */
export const reconcileMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? null;

    if (!customerId) {
      try {
        const search = await stripe.customers.search({
          query: `metadata['supabase_user_id']:'${userId}'`,
          limit: 1,
        });
        customerId = search.data[0]?.id ?? null;
      } catch {
        // search may be unavailable; fall through
      }
    }
    if (!customerId) {
      const email = (claims as { email?: string }).email;
      if (email) {
        const byEmail = await stripe.customers.list({ email, limit: 1 });
        customerId = byEmail.data[0]?.id ?? null;
      }
    }

    if (!customerId) return { reconciled: false as const, reason: "no_customer" as const };

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });
    const sub = subs.data[0];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!sub) {
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          status: null,
          price_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
        },
        { onConflict: "user_id" },
      );
      return { reconciled: true as const, status: null as string | null };
    }

    const item = sub.items.data[0];
    const periodEnd =
      (item as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end;

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        price_id: item?.price.id ?? null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      { onConflict: "user_id" },
    );

    return { reconciled: true as const, status: sub.status };
  });

/** Creates (or reuses) a Stripe Customer and an embedded Checkout Session for the subscription. */
export const createEmbeddedCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripe, requireEnv } = await import("./stripe.server");
    const stripe = getStripe();
    const priceId = requireEnv("STRIPE_PRICE_ID");

    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email ?? null;

    // Find/create customer.
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("subscriptions")
        .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
    }

    const origin =
      getRequestHeader("origin") ??
      (getRequestHeader("host") ? `https://${getRequestHeader("host")}` : "");

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page" as never,
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: userId },
      },
      metadata: { supabase_user_id: userId },
      allow_promotion_codes: true,
    });

    return { clientSecret: session.client_secret };
  });

/** Confirms a Checkout Session after the embedded flow completes. */
export const getCheckoutSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const s = await stripe.checkout.sessions.retrieve(data.sessionId);
    return { status: s.status, paymentStatus: s.payment_status, customerEmail: s.customer_details?.email ?? null };
  });

/** Creates a Stripe Customer Portal session and returns the URL. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const { supabase, userId } = context;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub?.stripe_customer_id) throw new Error("No Stripe customer on file. Subscribe first.");

    const origin =
      getRequestHeader("origin") ??
      (getRequestHeader("host") ? `https://${getRequestHeader("host")}` : "");

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/billing`,
    });
    return { url: portal.url };
  });
