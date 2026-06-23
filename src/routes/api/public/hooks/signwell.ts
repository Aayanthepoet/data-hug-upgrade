// SignWell webhook — POSTed when document status changes (sent, viewed,
// signed, declined, completed). We verify a shared token in the URL because
// SignWell's API hash uses the API key, which we already control.
//
// Expected URL: /api/public/hooks/signwell?token=<SIGNWELL_WEBHOOK_SECRET>
import { createFileRoute } from "@tanstack/react-router";

type SignwellEvent = {
  event?: { type?: string; time?: number };
  data?: {
    object?: {
      id?: string;
      status?: string;
      metadata?: { contract_id?: string; user_id?: string };
      files?: Array<{ name?: string; pdf_url?: string }>;
      signed_pdf_url?: string;
    };
  };
};

function mapStatus(eventType?: string, status?: string): string | null {
  if (eventType === "document_completed" || status === "Completed") return "signed";
  if (eventType === "document_signed") return "signed";
  if (eventType === "document_declined") return "declined";
  if (eventType === "document_viewed") return "viewed";
  if (eventType === "document_sent") return "sent";
  if (eventType === "document_canceled" || eventType === "document_cancelled") return "cancelled";
  return null;
}

export const Route = createFileRoute("/api/public/hooks/signwell")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SIGNWELL_WEBHOOK_SECRET;
        if (!expected) {
          console.warn("[signwell] SIGNWELL_WEBHOOK_SECRET not set");
          return new Response("Not configured", { status: 503 });
        }
        const url = new URL(request.url);
        const provided = url.searchParams.get("token") ?? "";
        if (provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: SignwellEvent;
        try {
          payload = (await request.json()) as SignwellEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const doc = payload.data?.object;
        const eventType = payload.event?.type;
        const docId = doc?.id;
        const contractId = doc?.metadata?.contract_id;

        if (!docId && !contractId) {
          // Nothing to correlate to.
          return Response.json({ ok: true, skipped: "no_id" });
        }

        const newStatus = mapStatus(eventType, doc?.status);
        if (!newStatus) {
          return Response.json({ ok: true, skipped: "ignored_event", eventType });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const update: {
          status: string;
          signed_at?: string;
          signed_pdf_url?: string;
        } = { status: newStatus };
        if (newStatus === "signed") {
          update.signed_at = new Date().toISOString();
          const signedUrl =
            doc?.signed_pdf_url ||
            doc?.files?.find((f) => f.pdf_url)?.pdf_url ||
            undefined;
          if (signedUrl) update.signed_pdf_url = signedUrl;
        }

        let query = supabaseAdmin.from("contracts").update(update);
        query = contractId
          ? query.eq("id", contractId)
          : query.eq("signwell_document_id", docId!);
        const { error } = await query;
        if (error) {
          console.error("[signwell] update failed", error.message);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        return Response.json({ ok: true, status: newStatus });
      },
      GET: async () => new Response("SignWell webhook OK", { status: 200 }),
    },
  },
});
