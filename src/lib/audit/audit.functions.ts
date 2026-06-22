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
