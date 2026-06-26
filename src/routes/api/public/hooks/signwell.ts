// SignWell webhook — POSTed when document status changes (sent, viewed,
// signed, declined, completed). We verify a shared token in the URL because
// SignWell's API hash uses the API key, which we already control.
//
// Expected URL: /api/public/hooks/signwell?token=<SIGNWELL_WEBHOOK_SECRET>
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

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
        if (!safeEq(provided, expected)) {
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
          signed_pdf_storage_path?: string;
        } = { status: newStatus };

        if (newStatus === "signed") {
          update.signed_at = new Date().toISOString();
          const signedUrl =
            doc?.signed_pdf_url ||
            doc?.files?.find((f) => f.pdf_url)?.pdf_url ||
            undefined;
          if (signedUrl) update.signed_pdf_url = signedUrl;

          // Fetch the signed PDF from SignWell and archive it in our private
          // storage bucket so it survives any SignWell URL expiry.
          try {
            const apiKey = process.env.SIGNWELL_API_KEY;
            if (apiKey && docId) {
              // Resolve which contract row this is so we know the owner folder.
              const { data: row } = await supabaseAdmin
                .from("contracts")
                .select("id, user_id")
                .eq(contractId ? "id" : "signwell_document_id", contractId ?? docId)
                .maybeSingle();

              if (row?.id && row.user_id) {
                const pdfResp = await fetch(
                  `https://www.signwell.com/api/v1/documents/${encodeURIComponent(docId)}/completed_pdf/?url_only=false`,
                  { headers: { "X-Api-Key": apiKey, Accept: "application/pdf" } },
                );
                if (pdfResp.ok) {
                  const bytes = new Uint8Array(await pdfResp.arrayBuffer());
                  const path = `${row.user_id}/${row.id}-signed.pdf`;
                  const { error: upErr } = await supabaseAdmin.storage
                    .from("contracts")
                    .upload(
                      path,
                      new Blob([bytes as BlobPart], { type: "application/pdf" }),
                      { contentType: "application/pdf", upsert: true },
                    );
                  if (upErr) {
                    console.error("[signwell] signed pdf upload failed", upErr.message);
                  } else {
                    update.signed_pdf_storage_path = path;
                  }
                } else {
                  console.error(
                    "[signwell] completed_pdf fetch failed",
                    pdfResp.status,
                    await pdfResp.text().catch(() => ""),
                  );
                }
              }
            }
          } catch (e) {
            console.error("[signwell] signed pdf archive error", (e as Error).message);
          }
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
