// Philadelphia live data provider — uses the city's free public Carto SQL API.
// No API key required.
//   - opa_properties_public  → base property records + owner + assessment
//   - real_estate_tax_balances → tax-delinquent flag
//
// Triggered when state === "PA" and county/city matches Philadelphia.

import type {
  DistressSearchFilters,
  DistressType,
  DistressedPropertyRecord,
  PropertyProvider,
} from "./provider";

export function isPhilly(filters: DistressSearchFilters): boolean {
  if ((filters.state ?? "").toUpperCase() !== "PA") return false;
  if (filters.county?.toLowerCase().includes("philadelphia")) return true;
  if (filters.city?.toLowerCase().includes("philadelphia")) return true;
  if (filters.zip?.startsWith("191") || filters.zip?.startsWith("190")) return true;
  return false;
}

async function cartoQuery<T>(sql: string): Promise<T[]> {
  const url = new URL("https://phl.carto.com/api/v2/sql");
  url.searchParams.set("q", sql);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Philly Carto ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { rows?: T[]; error?: string[] };
  if (json.error) throw new Error(`Philly Carto: ${json.error.join("; ")}`);
  return json.rows ?? [];
}

type OpaRow = {
  parcel_number: string;
  location: string | null;
  zip_code: string | null;
  owner_1: string | null;
  owner_2: string | null;
  mailing_street: string | null;
  mailing_city_state: string | null;
  market_value: number | null;
  total_livable_area: number | null;
  year_built: number | null;
  number_of_bedrooms: number | null;
  number_of_bathrooms: number | null;
  category_code_description: string | null;
  lat: number | null;
  lng: number | null;
};

async function fetchOpaProperties(
  zip: string | undefined,
  limit: number,
  minValue: number | undefined,
  maxValue: number | undefined,
  delinquentOnly: boolean,
): Promise<DistressedPropertyRecord[]> {
  const where: string[] = [
    "location IS NOT NULL",
    "owner_1 IS NOT NULL",
    "market_value > 0",
    "lat IS NOT NULL",
    "lng IS NOT NULL",
    // residential only
    "category_code_description ILIKE '%residential%'",
  ];
  if (zip) where.push(`zip_code LIKE '${zip.slice(0, 5)}%'`);
  if (minValue) where.push(`market_value >= ${minValue}`);
  if (maxValue) where.push(`market_value <= ${maxValue}`);

  // Join via parcel_number when looking for tax-delinquent.
  const sql = delinquentOnly
    ? `
      SELECT p.parcel_number, p.location, p.zip_code, p.owner_1, p.owner_2,
             p.mailing_street, p.mailing_city_state, p.market_value,
             p.total_livable_area, p.year_built, p.number_of_bedrooms,
             p.number_of_bathrooms, p.category_code_description,
             ST_Y(p.the_geom) AS lat, ST_X(p.the_geom) AS lng,
             t.total AS tax_owed
        FROM opa_properties_public p
        JOIN real_estate_tax_balances t ON t.opa_number = p.parcel_number
       WHERE ${where.join(" AND ")} AND t.total > 1000
       ORDER BY t.total DESC
       LIMIT ${limit}`
    : `
      SELECT parcel_number, location, zip_code, owner_1, owner_2,
             mailing_street, mailing_city_state, market_value,
             total_livable_area, year_built, number_of_bedrooms,
             number_of_bathrooms, category_code_description,
             ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng
        FROM opa_properties_public
       WHERE ${where.join(" AND ")}
       ORDER BY market_value DESC
       LIMIT ${limit}`;

  type Row = OpaRow & { tax_owed?: number };
  const rows = await cartoQuery<Row>(sql);

  return rows.map((r) => {
    const ownerName = [r.owner_1, r.owner_2].filter(Boolean).join(" & ");
    const propertyAddrUpper = (r.location ?? "").toUpperCase();
    const mailingAddrUpper = (r.mailing_street ?? "").toUpperCase();
    const isAbsentee =
      !!mailingAddrUpper &&
      mailingAddrUpper !== propertyAddrUpper &&
      !(r.mailing_city_state ?? "").toUpperCase().includes("PHILADELPHIA");

    const market = r.market_value ?? null;
    const distressType: DistressType = r.tax_owed
      ? "tax_delinquent"
      : isAbsentee
      ? "absentee"
      : "absentee";

    return {
      sourceRecordId: `philly-opa-${r.parcel_number}${r.tax_owed ? "-tax" : ""}`,
      address: titleCase(r.location ?? ""),
      city: "Philadelphia",
      state: "PA",
      zip: (r.zip_code ?? "").slice(0, 5) || null,
      county: "Philadelphia",
      propertyType: "residential",
      beds: r.number_of_bedrooms ?? null,
      baths: r.number_of_bathrooms ?? null,
      sqft: r.total_livable_area ?? null,
      yearBuilt: r.year_built ?? null,
      estimatedValue: market,
      equity: market ? Math.round(market * 0.5) : null,
      listPrice: null,
      listDate: null,
      daysOnMarket: null,
      auctionDate: null,
      taxOwed: r.tax_owed ?? null,
      lienAmount: r.tax_owed ?? null,
      distressType,
      listingStatus: "off_market" as const,
      ownerName: titleCase(ownerName),
      isAbsentee,
      isVacant: false,
      lat: r.lat,
      lng: r.lng,
    } satisfies DistressedPropertyRecord;
  });
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .trim();
}

export class PhillyCartoProvider implements PropertyProvider {
  readonly name = "philly_carto";

  async searchDistressed(filters: DistressSearchFilters): Promise<DistressedPropertyRecord[]> {
    const limit = Math.min(filters.limit ?? 50, 200);
    const types = new Set<DistressType>(
      filters.distressTypes?.length ? filters.distressTypes : ["tax_delinquent", "absentee"],
    );

    const tasks: Promise<DistressedPropertyRecord[]>[] = [];
    if (types.has("tax_delinquent") || types.has("tax_lien")) {
      tasks.push(
        fetchOpaProperties(filters.zip, limit, filters.minListPrice, filters.maxListPrice, true).catch(
          (e) => {
            console.error("[philly] tax-delinquent fetch failed:", e);
            return [];
          },
        ),
      );
    }
    if (types.has("absentee") || types.size === 0) {
      tasks.push(
        fetchOpaProperties(filters.zip, limit, filters.minListPrice, filters.maxListPrice, false).catch(
          (e) => {
            console.error("[philly] opa fetch failed:", e);
            return [];
          },
        ),
      );
    }

    const results = (await Promise.all(tasks)).flat();

    return results
      .filter((r) => {
        if (filters.minEquity != null && (r.equity ?? 0) < filters.minEquity) return false;
        if (filters.minBeds != null && (r.beds ?? 0) < filters.minBeds) return false;
        return true;
      })
      .slice(0, limit);
  }
}
