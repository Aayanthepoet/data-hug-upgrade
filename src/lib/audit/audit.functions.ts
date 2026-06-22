// Audit-log server functions. Records who did what to which records, with a
// freeform metadata payload (channel, filename, ranges, etc).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LogInput = z.object({
  action: z.string().min(1).max(64),
  resource_type: z.string().min(1).max(64),
  resource_ids: z.array(z.string().uuid()).max(5000).default([]),
  record_count: z.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("audit_logs")
      .insert({
        user_id: userId,
        action: data.action,
        resource_type: data.resource_type,
        resource_ids: data.resource_ids,
        record_count: data.record_count,
        metadata: data.metadata as never,
      } as never)
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const ListInput = z.object({
  action: z.string().optional().nullable(),
  resource_type: z.string().optional().nullable(),
  from: z.string().datetime().optional().nullable(),
  to: z.string().datetime().optional().nullable(),
  limit: z.number().int().min(1).max(5000).default(100),
});

export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("audit_logs")
      .select("id, action, resource_type, resource_ids, record_count, metadata, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    if (data.resource_type) q = q.eq("resource_type", data.resource_type);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const EXPORT_ALLOWED_ROLES = ["admin"] as const;

// Hard cap on rows returned per CSV export. Keeps a single download from
// pulling unbounded history; users must narrow filters / date range instead.
export const AUDIT_EXPORT_ROW_LIMIT = 1000;

export class AuditExportLimitError extends Error {
  matched: number;
  limit: number;
  constructor(matched: number, limit: number) {
    super(
      `Export too large: ${matched.toLocaleString()} rows match the current filters, ` +
        `but a single export is capped at ${limit.toLocaleString()}. ` +
        `Narrow the date range or pick a specific action and try again.`,
    );
    this.name = "AuditExportLimitError";
    this.matched = matched;
    this.limit = limit;
  }
}

export const getMyAuditPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role as string);
    const canExport = roles.some((r) => (EXPORT_ALLOWED_ROLES as readonly string[]).includes(r));
    return {
      roles,
      canExport,
      allowedRoles: [...EXPORT_ALLOWED_ROLES],
      exportRowLimit: AUDIT_EXPORT_ROW_LIMIT,
    };
  });

export const exportAuditEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase
      .rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) {
      throw new Error("Forbidden: audit log export requires the admin role.");
    }

    // Count matching rows first so we can give a precise error before
    // returning a truncated export.
    let countQ = supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true });
    if (data.action) countQ = countQ.eq("action", data.action);
    if (data.resource_type) countQ = countQ.eq("resource_type", data.resource_type);
    if (data.from) countQ = countQ.gte("created_at", data.from);
    if (data.to) countQ = countQ.lte("created_at", data.to);
    const { count, error: countErr } = await countQ;
    if (countErr) throw new Error(countErr.message);

    const matched = count ?? 0;
    if (matched > AUDIT_EXPORT_ROW_LIMIT) {
      throw new AuditExportLimitError(matched, AUDIT_EXPORT_ROW_LIMIT);
    }

    let q = supabase
      .from("audit_logs")
      .select("id, action, resource_type, resource_ids, record_count, metadata, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(AUDIT_EXPORT_ROW_LIMIT);
    if (data.action) q = q.eq("action", data.action);
    if (data.resource_type) q = q.eq("resource_type", data.resource_type);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], matched, limit: AUDIT_EXPORT_ROW_LIMIT };
  });
