import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        user_id: userId,
        channel_in_app: true,
        channel_sms: false,
        sms_phone: null,
        on_lead_reply: true,
        on_new_lead: true,
        on_auction_activity: true,
        quiet_enabled: false,
        quiet_start_local: "22:00:00",
        quiet_end_local: "07:00:00",
        timezone: "UTC",
      }
    );
  });

const PreferencesSchema = z.object({
  channel_in_app: z.boolean(),
  channel_sms: z.boolean(),
  sms_phone: z.string().trim().max(20).nullable().optional(),
  on_lead_reply: z.boolean(),
  on_new_lead: z.boolean(),
  on_auction_activity: z.boolean(),
  quiet_enabled: z.boolean(),
  quiet_start_local: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  quiet_end_local: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timezone: z.string().min(1).max(64),
});

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreferencesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Soft phone validation when SMS channel enabled
    let phone = data.sms_phone ?? null;
    if (phone) phone = phone.trim();
    if (data.channel_sms && (!phone || !/^\+?\d{7,15}$/.test(phone))) {
      throw new Error("Enter a valid phone number (E.164, e.g. +14155551234) to enable SMS alerts.");
    }

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: userId, ...data, sms_phone: phone },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    let q = supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
    if (data.ids && data.ids.length > 0) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone must be E.164 (e.g. +14155551234)") }).parse(input),
  )
  .handler(async ({ data }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !apiKey || !fromNumber) {
      throw new Error(
        "SMS is not fully configured. Missing Twilio credentials — contact your admin.",
      );
    }

    const body = "PropAI test alert ✅ — your SMS notifications are working.";
    const form = new URLSearchParams({
      To: data.phone,
      From: fromNumber,
      Body: body,
    });
    const auth = btoa(`${accountSid}:${apiKey}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!resp.ok) {
      let detail = "";
      try {
        const j = (await resp.json()) as { message?: string; code?: number };
        detail = j.message ? ` (${j.message}${j.code ? `, code ${j.code}` : ""})` : "";
      } catch {
        detail = "";
      }
      throw new Error(`Twilio rejected the test message${detail}`);
    }
    return { ok: true };
  });
