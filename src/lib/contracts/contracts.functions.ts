import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateSchema = z.object({
  property_id: z.string().uuid(),
  buyer_name: z.string().trim().min(1).max(120),
  seller_name: z.string().trim().min(1).max(120),
  buyer_email: z.string().trim().email().max(200).optional().nullable(),
  seller_email: z.string().trim().email().max(200).optional().nullable(),
  purchase_price: z.number().nonnegative().max(1_000_000_000),
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  send_for_signature: z.boolean().default(false),
});

export const listContractsForProperty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ property_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("user_id", userId)
      .eq("property_id", data.property_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getContractPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contract_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("contracts")
      .select("pdf_storage_path, signed_pdf_url")
      .eq("id", data.contract_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.pdf_storage_path) throw new Error("No PDF for this contract.");
    const { data: signed, error: e2 } = await supabase.storage
      .from("contracts")
      .createSignedUrl(row.pdf_storage_path, 60 * 10);
    if (e2) throw new Error(e2.message);
    return { url: signed.signedUrl, signed_pdf_url: row.signed_pdf_url };
  });

export const cancelContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contract_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("contracts")
      .update({ status: "cancelled" })
      .eq("id", data.contract_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Load property for address.
    const { data: prop, error: pErr } = await supabase
      .from("properties")
      .select("id, address, city, state, zip")
      .eq("id", data.property_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Property not found.");

    if (data.send_for_signature && (!data.buyer_email || !data.seller_email)) {
      throw new Error("Buyer and seller email are required to send for signature.");
    }

    const propertyAddress = [prop.address, prop.city, prop.state, prop.zip]
      .filter(Boolean)
      .join(", ");

    // 2. Generate PDF (pdf-lib).
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // US Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.07, 0.09, 0.15);
    const muted = rgb(0.35, 0.4, 0.5);

    let y = 740;
    const left = 54;

    page.drawText("REAL ESTATE PURCHASE AGREEMENT", {
      x: left, y, size: 16, font: bold, color: ink,
    });
    y -= 8;
    page.drawLine({ start: { x: left, y }, end: { x: 558, y }, thickness: 1, color: ink });
    y -= 24;
    page.drawText(
      `Effective date: ${new Date().toISOString().slice(0, 10)}`,
      { x: left, y, size: 10, font, color: muted },
    );
    y -= 28;

    const para = (label: string, value: string) => {
      page.drawText(label, { x: left, y, size: 10, font: bold, color: ink });
      page.drawText(value, { x: left + 130, y, size: 10, font, color: ink, maxWidth: 410 });
      y -= 20;
    };

    para("Buyer:", data.buyer_name);
    para("Seller:", data.seller_name);
    para("Property:", propertyAddress);
    para(
      "Purchase price:",
      `$${data.purchase_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
    );
    para("Closing date:", data.closing_date);
    para("Payment:", "All cash at closing");

    y -= 8;
    const terms = [
      "1. Seller agrees to sell and Buyer agrees to purchase the property described above on the",
      "   terms set forth herein. The purchase price shall be paid in full at closing.",
      "",
      "2. Closing shall occur on the closing date stated above, at a location mutually agreed by",
      "   the parties. Title shall be conveyed by general warranty deed, free of liens, except those",
      "   accepted by Buyer in writing.",
      "",
      "3. Property is sold AS-IS. Buyer has had the opportunity to inspect the property. Standard",
      "   prorations of taxes and assessments shall be made as of the closing date.",
      "",
      "4. This agreement constitutes the entire understanding of the parties and may only be",
      "   modified in a writing signed by both parties.",
    ];
    for (const line of terms) {
      page.drawText(line, { x: left, y, size: 10, font, color: ink });
      y -= 14;
    }

    y -= 26;
    page.drawLine({ start: { x: left, y }, end: { x: left + 220, y }, thickness: 0.5, color: ink });
    page.drawLine({ start: { x: left + 280, y }, end: { x: left + 500, y }, thickness: 0.5, color: ink });
    y -= 14;
    page.drawText(`Buyer: ${data.buyer_name}`, { x: left, y, size: 9, font, color: muted });
    page.drawText(`Seller: ${data.seller_name}`, { x: left + 280, y, size: 9, font, color: muted });
    y -= 12;
    page.drawText("Date: __________________", { x: left, y, size: 9, font, color: muted });
    page.drawText("Date: __________________", { x: left + 280, y, size: 9, font, color: muted });

    const pdfBytes = await pdf.save();

    // 3. Insert contract row (draft).
    const { data: created, error: insErr } = await supabase
      .from("contracts")
      .insert({
        user_id: userId,
        property_id: data.property_id,
        buyer_name: data.buyer_name,
        seller_name: data.seller_name,
        buyer_email: data.buyer_email ?? null,
        seller_email: data.seller_email ?? null,
        purchase_price: data.purchase_price,
        closing_date: data.closing_date,
        status: "draft",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // 4. Upload PDF.
    const path = `${userId}/${created.id}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("contracts")
      .upload(path, new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error(upErr.message);

    await supabase
      .from("contracts")
      .update({ pdf_storage_path: path })
      .eq("id", created.id);

    // 5. Optional: send to SignWell.
    if (data.send_for_signature) {
      const apiKey = process.env.SIGNWELL_API_KEY;
      const webhookSecret = process.env.SIGNWELL_WEBHOOK_SECRET;
      const publicBase =
        process.env.NOTIFY_PUBLIC_URL ||
        "https://project--f060fcf2-0071-41a6-8014-e8dd9520d418.lovable.app";

      if (!apiKey) {
        await supabase
          .from("contracts")
          .update({ status: "error", error_message: "SIGNWELL_API_KEY not configured" })
          .eq("id", created.id);
        throw new Error(
          "PDF saved as draft, but SignWell is not configured. Add SIGNWELL_API_KEY to enable e-signature.",
        );
      }

      // Base64-encode the PDF for SignWell.
      let bin = "";
      for (let i = 0; i < pdfBytes.length; i++) bin += String.fromCharCode(pdfBytes[i]);
      const fileBase64 = btoa(bin);

      const body = {
        test_mode: true,
        name: `Purchase Agreement - ${propertyAddress}`.slice(0, 100),
        subject: `Please sign: Purchase Agreement for ${propertyAddress}`.slice(0, 200),
        message: "Please review and sign the attached purchase agreement.",
        draft: false,
        with_signature_page: true,
        files: [{ name: `contract-${created.id}.pdf`, file_base64: fileBase64 }],
        recipients: [
          { id: "1", name: data.buyer_name, email: data.buyer_email!, order: 0 },
          { id: "2", name: data.seller_name, email: data.seller_email!, order: 0 },
        ],
        webhook_url: `${publicBase}/api/public/hooks/signwell?token=${encodeURIComponent(webhookSecret ?? "")}`,
        metadata: { contract_id: created.id, user_id: userId },
      };

      const resp = await fetch("https://www.signwell.com/api/v1/documents/", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json: { id?: string; errors?: unknown; message?: string } = await resp
        .json()
        .catch(() => ({}));

      if (!resp.ok || !json.id) {
        const msg =
          (json.errors && JSON.stringify(json.errors).slice(0, 200)) ||
          json.message ||
          `SignWell HTTP ${resp.status}`;
        await supabase
          .from("contracts")
          .update({ status: "error", error_message: msg })
          .eq("id", created.id);
        throw new Error(`SignWell rejected the document: ${msg}`);
      }

      await supabase
        .from("contracts")
        .update({
          signwell_document_id: json.id,
          status: "sent",
        })
        .eq("id", created.id);
    }

    return { id: created.id, ok: true };
  });
