import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: { rpc: (...a: unknown[]) => Promise<{ data: boolean | null; error: { message: string } | null }> }; userId: string }) {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: admin role required.");
}

export const getContractsHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required.");


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Counts by status (all-time).
    const { data: rows, error: e1 } = await supabaseAdmin
      .from("contracts")
      .select("status");
    if (e1) throw new Error(e1.message);
    const byStatus: Record<string, number> = {};
    for (const r of rows ?? []) {
      const s = String((r as { status: string }).status);
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    const total = (rows ?? []).length;

    // 2. Recent failures / webhooks that produced an error.
    const { data: errors, error: e2 } = await supabaseAdmin
      .from("contracts")
      .select("id, user_id, status, error_message, updated_at, signwell_document_id, buyer_name, seller_name")
      .or("status.eq.error,error_message.not.is.null")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (e2) throw new Error(e2.message);

    // 3. Recent updates across all contracts.
    const { data: recent, error: e3 } = await supabaseAdmin
      .from("contracts")
      .select(
        "id, user_id, status, updated_at, signed_at, buyer_name, seller_name, purchase_price, property_id, signed_pdf_storage_path",
      )
      .order("updated_at", { ascending: false })
      .limit(25);
    if (e3) throw new Error(e3.message);

    // 4. Stalled "sent" — sent more than 7 days ago, no movement.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: stalledSent, error: e4 } = await supabaseAdmin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .lt("updated_at", sevenDaysAgo);
    if (e4) throw new Error(e4.message);

    // 5. Signed but archive missing — webhook fetched signed PDF failed.
    const { count: signedMissingArchive, error: e5 } = await supabaseAdmin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "signed")
      .is("signed_pdf_storage_path", null);
    if (e5) throw new Error(e5.message);

    return {
      total,
      byStatus,
      stalledSent: stalledSent ?? 0,
      signedMissingArchive: signedMissingArchive ?? 0,
      errors: errors ?? [],
      recent: recent ?? [],
    };
  });
