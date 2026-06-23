import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const STATUS_VALUES = [
  "all",
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "cancelled",
  "error",
] as const;

export const listContractsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; search?: string; limit?: number }) =>
    z
      .object({
        status: z.enum(STATUS_VALUES).default("all"),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("contracts")
      .select(
        "id, user_id, status, buyer_name, seller_name, buyer_email, seller_email, purchase_price, closing_date, signed_at, error_message, updated_at, created_at, property_id, signwell_document_id",
      )
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search) {
      const term = `%${data.search.replace(/[%_]/g, "\\$&")}%`;
      q = q.or(
        `buyer_name.ilike.${term},seller_name.ilike.${term},buyer_email.ilike.${term},seller_email.ilike.${term}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { contracts: rows ?? [] };
  });

export const getContractAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string }) =>
    z.object({ contractId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract, error } = await supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contract) throw new Error("Contract not found");

    let property: Record<string, unknown> | null = null;
    if (contract.property_id) {
      const { data: p } = await supabaseAdmin
        .from("properties")
        .select("id, address, city, state, zip, estimated_value")
        .eq("id", contract.property_id)
        .maybeSingle();
      property = p ?? null;
    }

    const { data: owner } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", contract.user_id)
      .maybeSingle();

    return { contract, property, owner };
  });

export const sendContractFollowupAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; note?: string }) =>
    z
      .object({
        contractId: z.string().uuid(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract, error } = await supabaseAdmin
      .from("contracts")
      .select("id, user_id, buyer_name, seller_name, status")
      .eq("id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contract) throw new Error("Contract not found");

    const body =
      data.note?.trim() ||
      `Admin nudge: contract for ${contract.buyer_name} ← ${contract.seller_name} is in '${contract.status}'. Please follow up.`;

    // In-app notification to the contract owner
    const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
      user_id: contract.user_id,
      type: "contract_followup",
      title: "Admin follow-up requested",
      body,
      link: `/app/contracts/${contract.id}`,
      metadata: { contract_id: contract.id, sent_by_admin: context.userId },
    });
    if (notifErr) throw new Error(notifErr.message);

    // Audit trail
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "contract_followup_sent",
      resource_type: "contract",
      resource_ids: [contract.id],
      record_count: 1,
      metadata: { target_user_id: contract.user_id, note: data.note ?? null },
    });

    // Bump updated_at so the contract resurfaces in dashboards
    await supabaseAdmin
      .from("contracts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", contract.id);

    return { ok: true, sent_at: new Date().toISOString() };
  });

