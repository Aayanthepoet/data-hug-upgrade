import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseLocation } from "./location-parse";

export type BackfillResult = {
  leads: { scanned: number; updated: number };
  properties: { scanned: number; updated: number };
};

/**
 * Admin-only: parse address tokens out of free-form text in leads.message and
 * properties.address, then fill any blank city / neighborhood / state / zip
 * columns. Existing values are never overwritten.
 */
export const backfillLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackfillResult> => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- Leads -------------------------------------------------------------
    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from("leads")
      .select("id, message, company, city, state, zip, neighborhood")
      .or("city.is.null,state.is.null,zip.is.null")
      .limit(2000);
    if (leadsErr) throw new Error(leadsErr.message);

    let leadsUpdated = 0;
    for (const row of leads ?? []) {
      const haystack = [row.message, row.company].filter(Boolean).join(" \n ");
      if (!haystack) continue;
      const parsed = parseLocation(haystack);
      const patch: { city?: string; state?: string; zip?: string; neighborhood?: string } = {};
      if (!row.city && parsed.city) patch.city = parsed.city;
      if (!row.state && parsed.state) patch.state = parsed.state;
      if (!row.zip && parsed.zip) patch.zip = parsed.zip;
      if (!row.neighborhood && parsed.neighborhood) patch.neighborhood = parsed.neighborhood;
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", row.id);
      if (!error) leadsUpdated++;
    }

    // --- Properties --------------------------------------------------------
    const { data: props, error: propsErr } = await supabaseAdmin
      .from("properties")
      .select("id, address, city, state, zip, neighborhood, notes")
      .or("city.is.null,state.is.null,zip.is.null")
      .limit(2000);
    if (propsErr) throw new Error(propsErr.message);

    let propsUpdated = 0;
    for (const row of props ?? []) {
      const haystack = [row.address, row.notes].filter(Boolean).join(" \n ");
      const parsed = parseLocation(haystack);
      const patch: { city?: string; state?: string; zip?: string; neighborhood?: string } = {};
      if (!row.city && parsed.city) patch.city = parsed.city;
      if (!row.state && parsed.state) patch.state = parsed.state;
      if (!row.zip && parsed.zip) patch.zip = parsed.zip;
      if (!row.neighborhood && parsed.neighborhood) patch.neighborhood = parsed.neighborhood;
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabaseAdmin.from("properties").update(patch).eq("id", row.id);
      if (!error) propsUpdated++;
    }

    return {
      leads: { scanned: leads?.length ?? 0, updated: leadsUpdated },
      properties: { scanned: props?.length ?? 0, updated: propsUpdated },
    };
  });
