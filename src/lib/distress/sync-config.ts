// Targets for the nightly free-data sync.
// Edit this list to add/remove ZIPs. Sources are NYC Socrata + Philadelphia Carto.
// No paid APIs. ATTOM is intentionally not used here.

export type SyncTarget =
  | { provider: "nyc_opendata"; zip: string; borough?: string }
  | { provider: "philly_carto"; zip: string };

export const SYNC_TARGETS: SyncTarget[] = [
  // Brooklyn
  { provider: "nyc_opendata", zip: "11233", borough: "Kings (Brooklyn)" },
  { provider: "nyc_opendata", zip: "11216", borough: "Kings (Brooklyn)" },
  { provider: "nyc_opendata", zip: "11221", borough: "Kings (Brooklyn)" },
  // Bronx
  { provider: "nyc_opendata", zip: "10456", borough: "Bronx" },
  { provider: "nyc_opendata", zip: "10457", borough: "Bronx" },
  // Queens
  { provider: "nyc_opendata", zip: "11433", borough: "Queens" },
  // Philadelphia
  { provider: "philly_carto", zip: "19140" },
  { provider: "philly_carto", zip: "19132" },
  { provider: "philly_carto", zip: "19121" },
];

// Cap per (provider, zip) per run so a single sync stays bounded.
export const PER_TARGET_LIMIT = 200;
