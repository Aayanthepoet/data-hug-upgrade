import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!sig || !secret) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const { getStripe } = await import("@/lib/stripe/stripe.server");
        const stripe = getStripe();

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, secret);
        } catch (err) {
          console.error("[stripe webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        async function upsertFromSubscription(sub: Stripe.Subscription) {
          const userId =
            (sub.metadata?.supabase_user_id as string | undefined) ??
            (await resolveUserIdFromCustomer(stripe, sub.customer));
          if (!userId) {
            console.error("[stripe webhook] cannot resolve user for subscription", sub.id);
            return;
          }
          const item = sub.items.data[0];
          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: userId,
              stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
              stripe_subscription_id: sub.id,
              status: sub.status,
              price_id: item?.price.id ?? null,
              current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
              cancel_at_period_end: sub.cancel_at_period_end,
            },
            { onConflict: "user_id" },
          );
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              if (session.mode === "subscription" && session.subscription) {
                const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                await upsertFromSubscription(sub);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              await upsertFromSubscription(event.data.object as Stripe.Subscription);
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error("[stripe webhook] handler error", err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});

async function resolveUserIdFromCustomer(
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string | null> {
  const id = typeof customer === "string" ? customer : customer.id;
  const c = await stripe.customers.retrieve(id);
  if ("deleted" in c && c.deleted) return null;
  return ((c as Stripe.Customer).metadata?.supabase_user_id as string | undefined) ?? null;
}
