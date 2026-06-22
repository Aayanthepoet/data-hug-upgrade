// Fetches fresh, source-attributed enrichment for a saved property by
// re-querying the live free public APIs we used at search time:
//   - NYC: PLUTO (`64uk-42ks`) by BBL; ACRIS Legals (`8h5j-fqxa`) → Master
//          (`bnx9-e6tj`) → Parties (`636b-3b5g`); HPD Pre-Foreclosure (`9y3g-c5g6`).
//   - Philly: opa_properties_public, real_estate_tax_balances, li_violations
//             by parcel_number.
//
// Returns structured groups with explicit `source` labels so the UI can
// render "where did this come from" alongside every fact.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cachedJsonFetch } from "./cached-fetch.server";

const inputSchema = z.object({ propertyId: z.string().uuid() });

export type DetailFact = { label: string; value: string | number | null };
export type TimelineEvent = {
  date: string;             // YYYY-MM-DD
  kind: "deed" | "mortgage" | "satisfaction" | "lis_pendens" | "assignment" | "foreclosure" | "other";
  title: string;
  amount: number | null;
  from: string | null;
  to: string | null;
  docId: string | null;
};
export type DetailGroup = {
  source: string;            // e.g. "NYC PLUTO (64uk-42ks)"
  sourceUrl: string;         // link to the dataset
  title: string;             // human-readable section title
  facts: DetailFact[];
  rows?: Record<string, string | number | null>[]; // tabular records
  timeline?: TimelineEvent[];
};

export const getPropertyDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: prop, error } = await context.supabase
      .from("properties")
      .select(
        `id, address, city, state, zip, county, source_provider, source_record_id,
         estimated_value, equity, lead_score, distress_type, list_price, days_on_market,
         tax_owed, lien_amount, beds, baths, sqft, year_built, property_type`,
      )
      .eq("id", data.propertyId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) throw new Error("Property not found");

    const groups: DetailGroup[] = [];
    const provider = prop.source_provider ?? "";
    const sourceId = prop.source_record_id ?? "";

    if (provider === "nyc_opendata") {
      // PLUTO BBL is embedded in sourceRecordId as `nyc-pluto-{bbl}`
      const bbl = sourceId.startsWith("nyc-pluto-")
        ? sourceId.slice("nyc-pluto-".length)
        : null;
      if (bbl) {
        groups.push(...(await fetchNYC(bbl)));
      } else {
        // Pre-foreclosure record — re-query the HPD dataset by address
        const addr = prop.address;
        if (addr) groups.push(await fetchNYCPreF(addr, prop.zip));
      }
    } else if (provider === "philly_carto") {
      const parcel = sourceId.startsWith("philly-opa-")
        ? sourceId.slice("philly-opa-".length).replace(/-tax$/, "")
        : null;
      if (parcel) groups.push(...(await fetchPhilly(parcel)));
    }

    return { property: prop, groups };
  });

// ----------------- NYC -----------------
const NYC_BASE = "https://data.cityofnewyork.us/resource";

async function soql<T>(dataset: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${NYC_BASE}/${dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return cachedJsonFetch<T[]>(url.toString(), {
    label: `nyc:${dataset}`,
    ttlMs: 10 * 60_000,
  });
}

async function fetchNYC(bbl: string): Promise<DetailGroup[]> {
  // Borough code = first digit; block = next 5; lot = last 4
  const borough = bbl.charAt(0);
  const block = bbl.slice(1, 6).replace(/^0+/, "") || "0";
  const lot = bbl.slice(6).replace(/^0+/, "") || "0";

  const [pluto, legals] = await Promise.all([
    soql<any>("64uk-42ks", { $where: `bbl = '${bbl}'`, $limit: "1" }).catch(() => [] as any[]),
    soql<any>("8h5j-fqxa", {
      $where: `borough = '${borough}' AND block = '${block}' AND lot = '${lot}'`,
      $select: "document_id, street_number, street_name, unit, good_through_date",
      $order: "good_through_date DESC",
      $limit: "25",
    }).catch(() => [] as any[]),
  ]);

  const groups: DetailGroup[] = [];

  // PLUTO summary
  if (pluto[0]) {
    const p = pluto[0];
    groups.push({
      source: "NYC PLUTO (64uk-42ks)",
      sourceUrl: "https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks",
      title: "Tax lot & assessment",
      facts: [
        { label: "BBL", value: p.bbl ?? bbl },
        { label: "Owner of record", value: p.ownername ?? null },
        { label: "Building class", value: p.bldgclass ?? null },
        { label: "Land use", value: p.landuse ?? null },
        { label: "Year built", value: numOrNull(p.yearbuilt) },
        { label: "Year altered", value: numOrNull(p.yearalter1) },
        { label: "Lot area (sqft)", value: numOrNull(p.lotarea) },
        { label: "Building area (sqft)", value: numOrNull(p.bldgarea) },
        { label: "Residential units", value: numOrNull(p.unitsres) },
        { label: "Total units", value: numOrNull(p.unitstotal) },
        { label: "Floors", value: numOrNull(p.numfloors) },
        { label: "Assessed land", value: dollars(p.assessland) },
        { label: "Assessed total", value: dollars(p.assesstot) },
        { label: "Zoning", value: p.zonedist1 ?? null },
        { label: "Historic district", value: p.histdist ?? "None" },
      ],
    });
  }

  // ACRIS — pull recent documents joined via document_id
  const docIds = Array.from(new Set(legals.map((l: any) => l.document_id).filter(Boolean))).slice(0, 15);
  if (docIds.length) {
    const idList = docIds.map((id) => `'${id}'`).join(",");
    const [masters, parties] = await Promise.all([
      soql<any>("bnx9-e6tj", {
        $where: `document_id in (${idList})`,
        $select: "document_id, doc_type, document_date, document_amt, recorded_filed",
        $order: "document_date DESC",
        $limit: "50",
      }).catch(() => []),
      soql<any>("636b-3b5g", {
        $where: `document_id in (${idList})`,
        $select: "document_id, name, party_type, address_1, city, state, zip",
        $limit: "200",
      }).catch(() => []),
    ]);

    const partyByDoc = new Map<string, any[]>();
    for (const p of parties) {
      const arr = partyByDoc.get(p.document_id) ?? [];
      arr.push(p);
      partyByDoc.set(p.document_id, arr);
    }

    const docRows = masters.map((m: any) => {
      const ps = partyByDoc.get(m.document_id) ?? [];
      const grantor = ps.find((p) => p.party_type === "1")?.name ?? "";
      const grantee = ps.find((p) => p.party_type === "2")?.name ?? "";
      return {
        Date: m.document_date?.slice(0, 10) ?? null,
        Type: friendlyDocType(m.doc_type),
        Amount: m.document_amt ? dollars(m.document_amt) : null,
        "From (party 1)": titleCase(grantor),
        "To (party 2)": titleCase(grantee),
        "Doc ID": m.document_id,
      };
    });

    // Build a chronological timeline summarizing deed/mortgage activity
    const timeline: TimelineEvent[] = masters
      .filter((m: any) => m.document_date)
      .map((m: any) => {
        const ps = partyByDoc.get(m.document_id) ?? [];
        const grantor = titleCase(ps.find((p) => p.party_type === "1")?.name ?? "") || null;
        const grantee = titleCase(ps.find((p) => p.party_type === "2")?.name ?? "") || null;
        const code = (m.doc_type ?? "").toUpperCase();
        const kind: TimelineEvent["kind"] =
          code.startsWith("DEED") ? "deed"
          : code === "FCD" ? "foreclosure"
          : code === "MTGE" ? "mortgage"
          : code === "AMTG" ? "assignment"
          : code === "SATM" ? "satisfaction"
          : code === "LP" ? "lis_pendens"
          : "other";
        return {
          date: m.document_date.slice(0, 10),
          kind,
          title: friendlyDocType(m.doc_type),
          amount: numOrNull(m.document_amt),
          from: grantor,
          to: grantee,
          docId: m.document_id ?? null,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    // Summary stats for the timeline header
    const deeds = timeline.filter((e) => e.kind === "deed" || e.kind === "foreclosure");
    const mortgages = timeline.filter((e) => e.kind === "mortgage");
    const satisfactions = timeline.filter((e) => e.kind === "satisfaction");
    const lisPendens = timeline.filter((e) => e.kind === "lis_pendens");
    const lastSale = deeds.find((e) => e.amount && e.amount > 1);
    const totalMortgaged = mortgages.reduce((s, e) => s + (e.amount ?? 0), 0);

    groups.push({
      source: "NYC ACRIS Real Property (bnx9-e6tj + 636b-3b5g + 8h5j-fqxa)",
      sourceUrl: "https://www.nyc.gov/site/finance/property/acris.page",
      title: `Title & lien timeline — ${timeline.length} events`,
      facts: [
        { label: "Recorded documents", value: timeline.length },
        { label: "Deed transfers", value: deeds.length },
        { label: "Mortgages originated", value: mortgages.length },
        { label: "Mortgages satisfied", value: satisfactions.length },
        { label: "Lis pendens (preforeclosure)", value: lisPendens.length },
        { label: "Last sale", value: lastSale ? `${lastSale.date} · ${dollars(lastSale.amount)}` : null },
        { label: "Total mortgages recorded", value: totalMortgaged ? dollars(totalMortgaged) : null },
      ],
      timeline,
      rows: docRows,
    });
  }

  return groups;
}

async function fetchNYCPreF(address: string, zip: string | null): Promise<DetailGroup> {
  const where = [`upper(property_address) = upper('${escapeSql(address)}')`];
  if (zip) where.push(`zip_code = '${zip}'`);
  const rows = await soql<any>("9y3g-c5g6", {
    $where: where.join(" AND "),
    $order: "date_notice_received DESC",
    $limit: "10",
  }).catch(() => []);
  return {
    source: "NYC HPD Pre-Foreclosure Notices (9y3g-c5g6)",
    sourceUrl: "https://data.cityofnewyork.us/Housing-Development/Pre-foreclosure-Notices-Received/9y3g-c5g6",
    title: `Pre-foreclosure filings — ${rows.length}`,
    facts: [],
    rows: rows.map((r: any) => ({
      "Notice received": r.date_notice_received?.slice(0, 10) ?? null,
      "First default": r.date_of_first_default?.slice(0, 10) ?? null,
      Servicer: r.servicer_name ?? null,
      Units: numOrNull(r.number_of_units),
    })),
  };
}

function friendlyDocType(code: string | undefined): string {
  const map: Record<string, string> = {
    DEED: "Deed", DEEDO: "Deed (other)", FCD: "Foreclosure deed",
    MTGE: "Mortgage", AMTG: "Assignment of mortgage", SATM: "Satisfaction of mortgage",
    LP: "Lis pendens (preforeclosure)", AGMT: "Agreement", POA: "Power of attorney",
    AALR: "Assignment of leases & rents", UCC1: "UCC filing",
  };
  return map[code ?? ""] ?? code ?? "—";
}

// ----------------- Philly -----------------
async function carto<T>(sql: string): Promise<T[]> {
  const url = `https://phl.carto.com/api/v2/sql?q=${encodeURIComponent(sql)}`;
  const j = await cachedJsonFetch<{ rows?: T[] }>(url, {
    label: "philly:carto",
    ttlMs: 10 * 60_000,
  });
  return j.rows ?? [];
}

async function fetchPhilly(parcel: string): Promise<DetailGroup[]> {
  const safe = parcel.replace(/[^0-9A-Za-z]/g, "");
  const [opaRows, taxRows, liRows] = await Promise.all([
    carto<any>(
      `SELECT parcel_number, location, zip_code, owner_1, owner_2, mailing_street,
              mailing_city_state, mailing_zip, market_value, taxable_land, taxable_building,
              total_livable_area, year_built, year_built_estimate, number_of_bedrooms,
              number_of_bathrooms, number_stories, exterior_condition, interior_condition,
              category_code_description, zoning, sale_price, sale_date,
              ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng
         FROM opa_properties_public WHERE parcel_number = '${safe}' LIMIT 1`,
    ).catch(() => []),
    carto<any>(
      `SELECT tax_period, principal, interest, penalty, other, total, lien_number
         FROM real_estate_tax_balances WHERE opa_number = '${safe}'
         ORDER BY tax_period DESC LIMIT 25`,
    ).catch(() => []),
    carto<any>(
      `SELECT violationdate, violationcodetitle, casenumber, casestatus, casepriority
         FROM li_violations WHERE opa_account_num = '${safe}'
         ORDER BY violationdate DESC LIMIT 25`,
    ).catch(() => []),
  ]);

  const groups: DetailGroup[] = [];
  if (opaRows[0]) {
    const o = opaRows[0];
    const mailing = [o.mailing_street, o.mailing_city_state, o.mailing_zip].filter(Boolean).join(", ");
    groups.push({
      source: "Philadelphia OPA — opa_properties_public",
      sourceUrl: "https://opendataphilly.org/datasets/opa-property-assessments/",
      title: "Office of Property Assessment",
      facts: [
        { label: "Parcel #", value: o.parcel_number },
        { label: "Owner 1", value: titleCase(o.owner_1 ?? "") || null },
        { label: "Owner 2", value: titleCase(o.owner_2 ?? "") || null },
        { label: "Mailing address", value: mailing ? titleCase(mailing) : null },
        { label: "Category", value: o.category_code_description ?? null },
        { label: "Zoning", value: o.zoning ?? null },
        { label: "Year built", value: numOrNull(o.year_built) },
        { label: "Beds", value: numOrNull(o.number_of_bedrooms) },
        { label: "Baths", value: numOrNull(o.number_of_bathrooms) },
        { label: "Stories", value: numOrNull(o.number_stories) },
        { label: "Livable area (sqft)", value: numOrNull(o.total_livable_area) },
        { label: "Exterior condition", value: o.exterior_condition ?? null },
        { label: "Interior condition", value: o.interior_condition ?? null },
        { label: "Market value", value: dollars(o.market_value) },
        { label: "Last sale price", value: o.sale_price ? dollars(o.sale_price) : null },
        { label: "Last sale date", value: o.sale_date?.slice(0, 10) ?? null },
      ],
    });
  }

  if (taxRows.length) {
    groups.push({
      source: "Philadelphia Revenue — real_estate_tax_balances",
      sourceUrl: "https://opendataphilly.org/datasets/real-estate-tax-balances/",
      title: `Real-estate tax balances — ${taxRows.length}`,
      facts: [
        {
          label: "Total owed",
          value: dollars(taxRows.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0)),
        },
        {
          label: "Oldest period",
          value: taxRows[taxRows.length - 1]?.tax_period ?? null,
        },
      ],
      rows: taxRows.map((r: any) => ({
        Period: r.tax_period,
        Principal: dollars(r.principal),
        Interest: dollars(r.interest),
        Penalty: dollars(r.penalty),
        Other: dollars(r.other),
        Total: dollars(r.total),
        Lien: r.lien_number ?? null,
      })),
    });
  }

  if (liRows.length) {
    groups.push({
      source: "Philadelphia L&I Violations — li_violations",
      sourceUrl: "https://opendataphilly.org/datasets/licenses-and-inspections-violations/",
      title: `Code violations — ${liRows.length}`,
      facts: [],
      rows: liRows.map((r: any) => ({
        Date: r.violationdate?.slice(0, 10) ?? null,
        Violation: r.violationcodetitle,
        Case: r.casenumber,
        Status: r.casestatus,
        Priority: r.casepriority,
      })),
    });
  }

  return groups;
}

// ----------------- utils -----------------
function numOrNull(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dollars(v: any): string | null {
  const n = numOrNull(v);
  return n == null ? null : `$${n.toLocaleString()}`;
}
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase()).trim();
}
function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}
