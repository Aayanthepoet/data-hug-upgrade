// Skip-trace server functions. Calls the provider (mock today,
// BatchSkipTracing later) and upserts results into public.contacts so
// the outreach + AI-call modules can consume them.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/billing/require-subscription.server";
import { getSkipTraceProvider } from "./mock-provider.server";

const Input = z.object({ owner_id: z.string().uuid() });

export const runSkipTrace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: owner, error: oErr } = await supabase
      .from("owners")
      .select("id, full_name, mailing_address, mailing_city, mailing_state, mailing_zip")
      .eq("id", data.owner_id)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!owner) throw new Error("Owner not found");

    const provider = getSkipTraceProvider();
    const result = await provider.trace({
      fullName: owner.full_name,
      mailingAddress: owner.mailing_address,
      mailingCity: owner.mailing_city,
      mailingState: owner.mailing_state,
      mailingZip: owner.mailing_zip,
    });

    // Map provider types to the constrained contact_type values your UI uses.
    // Anything that isn't a phone/email gets stored as `notes` on a phone/email
    // row or as a free-form note via the relative/address fallback.
    const phoneEmailRows = result.contacts
      .filter((c) => c.contact_type === "phone" || c.contact_type === "email")
      .map((c) => ({
        owner_id: data.owner_id,
        contact_type: c.contact_type,
        value: c.value,
        confidence: Math.round(c.confidence),
        user_id: userId,
        notes: `Skip trace · ${result.provider}${c.notes ? ` · ${c.notes}` : ""}`,
      }));

    const otherRows = result.contacts
      .filter((c) => c.contact_type !== "phone" && c.contact_type !== "email")
      .map((c) => ({
        owner_id: data.owner_id,
        // Park relatives + addresses as "linkedin" type for now (already in the
        // contact_type enum) with a clearly labelled note, until the schema
        // gets a richer enum. Keeps the UI table simple.
        contact_type: "linkedin",
        value: `${c.contact_type === "relative" ? "Relative: " : "Address: "}${c.value}`,
        confidence: Math.round(c.confidence),
        user_id: userId,
        notes: `Skip trace · ${result.provider}${c.notes ? ` · ${c.notes}` : ""}`,
      }));

    const rows = [...phoneEmailRows, ...otherRows];
    if (rows.length) {
      const { error: iErr } = await supabase.from("contacts").insert(rows as never);
      if (iErr) throw new Error(iErr.message);
    }

    // Stamp skip-trace status on the owner so the UI can show pending/traced/no-hit.
    const status = phoneEmailRows.length > 0 ? "traced" : "no_hit";
    await supabase
      .from("owners")
      .update({ skip_trace_status: status, skip_trace_last_run_at: new Date().toISOString() } as never)
      .eq("id", data.owner_id);

    return {
      provider: result.provider,
      inserted: rows.length,
      status,
      contacts: result.contacts,
    };
  });

export const listOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("owners")
      .select("id, full_name, entity_type, mailing_city, mailing_state, mailing_zip, property_id, skip_trace_status, skip_trace_last_run_at, properties(address)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Count contacts per owner so the UI can show "5 contacts" badges.
    const ids = (data ?? []).map((o) => o.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: contactRows } = await context.supabase
        .from("contacts")
        .select("owner_id")
        .in("owner_id", ids);
      counts = (contactRows ?? []).reduce((acc, r) => {
        const k = r.owner_id as string;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }

    return (data ?? []).map((o) => ({ ...o, contact_count: counts[o.id] ?? 0 }));
  });

export const listOwnerContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ owner_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("contacts")
      .select("id, contact_type, value, confidence, notes, is_verified, do_not_contact, created_at")
      .eq("owner_id", data.owner_id)
      .order("confidence", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setContactDoNotContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ contact_id: z.string().uuid(), do_not_contact: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contacts")
      .update({ do_not_contact: data.do_not_contact } as never)
      .eq("id", data.contact_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
