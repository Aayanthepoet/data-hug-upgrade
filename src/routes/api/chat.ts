import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are PropAI Agent, an assistant for a real-estate investor inside the PropAI app.

You have read access to the user's private workspace via tools:
- list_properties: browse the user's saved properties (with lead scores and distress flags)
- get_property: full details for one property including its owner(s) and contact info
- list_recent_leads: inbound contact-form leads from the public site

Use tools proactively when the user asks about their data. When summarizing leads:
- group by distress signal (preforeclosure / vacant / absentee) and equity
- highlight the highest-scoring opportunities
- be concise; use markdown bullet lists

When drafting outreach messages:
- adapt tone to the channel (SMS = short and casual, email = warm and professional, letter = personal)
- weave in concrete facts you found via tools (address, owner name, equity, distress signal)
- always offer 2-3 variations
- never invent owner names, phone numbers, or details that aren't in the data

TASK MODE:
When the user asks for a plan, checklist, next steps, "what should I do", or the message is prefixed with [TASK MODE], you MUST call the create_task_plan tool to return a structured, actionable checklist. Group tasks into sections like "Contacts to call", "Outreach drafts", "Auction steps", "Research". Each task should be concrete, one action, and reference specific properties/owners by name when possible. After calling the tool, give a one-sentence summary — do not repeat the list as prose.

If the workspace is empty, say so plainly and suggest the user add properties first.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabasePublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!supabaseUrl || !supabasePublishable) return new Response("Server misconfigured", { status: 500 });
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = createClient<Database>(supabaseUrl, supabasePublishable, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) return new Response("Messages required", { status: 400 });

        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          list_properties: tool({
            description: "List the user's saved properties. Returns up to 50 most recent, with lead score and distress flags.",
            inputSchema: z.object({
              min_score: z.number().min(0).max(100).optional().describe("Only return properties with lead_score >= this"),
              distress_only: z.boolean().optional().describe("Only return preforeclosure, vacant, or absentee properties"),
            }),
            execute: async ({ min_score, distress_only }) => {
              let q = supabase
                .from("properties")
                .select("id, address, city, state, zip, estimated_value, equity, lead_score, is_preforeclosure, is_vacant, is_absentee")
                .order("lead_score", { ascending: false, nullsFirst: false })
                .limit(50);
              if (typeof min_score === "number") q = q.gte("lead_score", min_score);
              if (distress_only) q = q.or("is_preforeclosure.eq.true,is_vacant.eq.true,is_absentee.eq.true");
              const { data, error } = await q;
              if (error) return { error: error.message };
              return { count: data?.length ?? 0, properties: data ?? [] };
            },
          }),
          get_property: tool({
            description: "Get full details for one property including linked owners and their contacts.",
            inputSchema: z.object({ property_id: z.string().uuid() }),
            execute: async ({ property_id }) => {
              const { data: property, error } = await supabase
                .from("properties").select("*").eq("id", property_id).maybeSingle();
              if (error) return { error: error.message };
              if (!property) return { error: "Property not found" };
              const { data: owners } = await supabase
                .from("owners").select("id, full_name, entity_type, mailing_address").eq("property_id", property_id);
              const ownerIds = (owners ?? []).map(o => o.id);
              const { data: contacts } = ownerIds.length
                ? await supabase.from("contacts")
                    .select("id, owner_id, contact_type, value, confidence, do_not_contact")
                    .in("owner_id", ownerIds)
                : { data: [] };
              return { property, owners: owners ?? [], contacts: contacts ?? [] };
            },
          }),
          list_recent_leads: tool({
            description: "List the most recent inbound leads from the public contact form (admin-only). Returns empty if the user is not an admin.",
            inputSchema: z.object({ limit: z.number().min(1).max(50).default(20) }),
            execute: async ({ limit }) => {
              const { data, error } = await supabase
                .from("leads").select("id, full_name, email, company, phone, message, status, created_at")
                .order("created_at", { ascending: false }).limit(limit);
              if (error) return { error: error.message };
              return { count: data?.length ?? 0, leads: data ?? [] };
            },
          }),
        };

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});
