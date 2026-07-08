import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PropertyTypeEnum = z.enum([
  "Pre-Foreclosure",
  "Auction",
  "Bank REO",
  "Short Sale",
]);

const PropertySchema = z.object({
  address: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  type: z.string(),
  price: z.string(),
  beds: z.string(),
  baths: z.string(),
  sqft: z.string(),
  auctionDate: z.string(),
  indexNo: z.string(),
  lender: z.string(),
  owner: z.string(),
  ownerPhone: z.string(),
  ownerEmail: z.string(),
  ownerAddress: z.string(),
  contactSource: z.string(),
  notes: z.string(),
});

export type ForeclosureProperty = z.infer<typeof PropertySchema>;

const SearchInput = z.object({
  county: z.string().min(1).max(120),
  type: z.string().min(1).max(60),
});

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

export const searchForeclosureProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const typeClause =
      data.type === "All" ? "any distress type" : `only "${data.type}" listings`;

    const system =
      "You are a NY foreclosure research agent. Search NYC Courts, PropertyShark, Zillow, RealtyTrac, and Foreclosure.com for the selected county. Return realistic, publicly-sourced data. If a field is unknown, return an empty string for that field. Never invent phone numbers or emails you are not confident about.";

    const prompt = `County: ${data.county}\nFilter: ${typeClause}\n\nReturn 8 to 12 properties as a JSON object { "properties": [...] }. Each property MUST have these string fields: address, city, neighborhood, type (one of Pre-Foreclosure, Auction, Bank REO, Short Sale), price, beds, baths, sqft, auctionDate, indexNo, lender, owner, ownerPhone, ownerEmail, ownerAddress, contactSource, notes.`;

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt,
        output: Output.object({
          schema: z.object({ properties: z.array(PropertySchema) }),
        }),
      });
      return { properties: output.properties };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = JSON.parse(error.text ?? "{}");
          if (parsed?.properties && Array.isArray(parsed.properties)) {
            return { properties: parsed.properties as ForeclosureProperty[] };
          }
        } catch {
          // fall through
        }
        return { properties: [] as ForeclosureProperty[] };
      }
      throw error;
    }
  });

const LetterInput = z.object({
  property: PropertySchema,
});

export const generateOutreachLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LetterInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You are Aayan Spencer, a NY-based real estate investor. Write warm, respectful, direct outreach letters to distressed-property owners. Never overpromise. Sign as: Aayan Spencer, 347-383-6660.",
      prompt: `Write a single ~180-word outreach letter to the owner of this distressed property. Reference the situation gently and offer a no-obligation conversation. End with the signature line "Aayan Spencer — 347-383-6660".\n\nProperty:\n${JSON.stringify(data.property, null, 2)}`,
    });
    return { letter: text.trim() };
  });

export const analyzeInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LetterInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You are a NY real estate investment analyst. Given a distressed property, produce a concise investment analysis: estimated ARV range, likely repair cost range, MAO (70% rule), exit strategies (wholesale, flip, BRRRR), and key risks. Be explicit that figures are estimates.",
      prompt: `Analyze this property. Keep the response under 350 words, use short section headers.\n\n${JSON.stringify(data.property, null, 2)}`,
    });
    return { analysis: text.trim() };
  });

const SkipInput = z.object({
  property: PropertySchema,
});

export const skipTraceOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SkipInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system:
          "You are a NY public-records skip-trace assistant. Suggest realistic owner-contact leads using publicly available NY records patterns (ACRIS filings, DOB owner contact, county tax mailing address). Never fabricate specific phone numbers or emails; leave unknown fields as empty strings. Mark all results as suggestions with a confidence score.",
        prompt: `Suggest up to 3 likely contact leads for the owner of this property.\n\n${JSON.stringify(data.property, null, 2)}`,
        output: Output.object({
          schema: z.object({
            leads: z.array(
              z.object({
                type: z.string(),
                value: z.string(),
                source: z.string(),
                confidence: z.string(),
                rationale: z.string(),
              }),
            ),
          }),
        }),
      });
      return { leads: output.leads };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) return { leads: [] };
      throw error;
    }
  });
