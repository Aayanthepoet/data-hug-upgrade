// Outreach server functions. Sends through pluggable provider (mock today),
// records every attempt to public.outreach_messages, and exposes list +
// reply-tracking helpers consumed by the Outreach UI and inbound webhook.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Channel = z.enum(["sms", "email", "mail"]);

const SendInput = z.object({
  owner_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  channel: Channel,
  to: z.string().min(3),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(8000),
});

export const sendOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Insert a queued row so we always have an audit record even if the
    //    provider call throws.
    const { data: inserted, error: insErr } = await supabase
      .from("outreach_messages")
      .insert({
        user_id: userId,
        owner_id: data.owner_id ?? null,
        contact_id: data.contact_id ?? null,
        campaign_id: data.campaign_id ?? null,
        channel: data.channel,
        direction: "outbound",
        to_value: data.to,
        subject: data.subject ?? null,
        body: data.body,
        status: "queued",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // 2. Dispatch via provider (mock).
    const { dispatch } = await import("./mock-providers.server");
    let result;
    try {
      result = await dispatch({
        channel: data.channel,
        to: data.to,
        subject: data.subject ?? null,
        body: data.body,
      });
    } catch (e) {
      await supabase
        .from("outreach_messages")
        .update({ status: "failed", error: (e as Error).message })
        .eq("id", inserted.id);
      throw e;
    }

    // 3. Patch the row with provider outcome.
    const { error: updErr } = await supabase
      .from("outreach_messages")
      .update({
        status: result.status,
        provider: result.provider,
        provider_message_id: result.providerMessageId,
        error: result.error ?? null,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", inserted.id);
    if (updErr) throw new Error(updErr.message);

    return { id: inserted.id, ...result };
  });

export const listOutreach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      owner_id: z.string().uuid().nullable().optional(),
      channel: Channel.nullable().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("outreach_messages")
      .select("id, owner_id, contact_id, channel, direction, to_value, subject, body, status, response, sent_at, replied_at, error, provider, created_at, owners(full_name)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.owner_id) q = q.eq("owner_id", data.owner_id);
    if (data.channel) q = q.eq("channel", data.channel);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const recordReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      message_id: z.string().uuid(),
      response: z.string().min(1).max(8000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("outreach_messages")
      .update({ status: "replied", response: data.response, replied_at: now })
      .eq("id", data.message_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
