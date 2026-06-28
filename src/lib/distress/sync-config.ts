// Targets for the nightly free-data sync.
// Sources are NYC Socrata + Philadelphia Carto. No paid APIs.

import type { NYCSignalProvider } from "./nyc-signals-provider.server";

export type SyncTarget =
  | { provider: "nyc_opendata"; zip: string; borough?: string }
  | { provider: "philly_carto"; zip: string }
  | { provider: NYCSignalProvider; zip: string };

const NYC_ZIPS: { zip: string; borough: string }[] = [
  // Brooklyn
  { zip: "11233", borough: "Kings (Brooklyn)" },
  { zip: "11216", borough: "Kings (Brooklyn)" },
  { zip: "11221", borough: "Kings (Brooklyn)" },
  // Bronx
  { zip: "10456", borough: "Bronx" },
  { zip: "10457", borough: "Bronx" },
  // Queens
  { zip: "11433", borough: "Queens" },
];

const PHILLY_ZIPS = ["19140", "19132", "19121"];

const NYC_SIGNAL_PROVIDERS: NYCSignalProvider[] = [
  "nyc_dof_tax_lien",
  "nyc_hpd_litigation",
  "nyc_marshal_eviction",
  "nyc_dob_vacate",
];

export const SYNC_TARGETS: SyncTarget[] = [
  // PLUTO absentee
  ...NYC_ZIPS.map(({ zip, borough }) => ({ provider: "nyc_opendata" as const, zip, borough })),
  // Philly OPA / tax-delinquent
  ...PHILLY_ZIPS.map((zip) => ({ provider: "philly_carto" as const, zip })),
  // NYC Distress Signals (one target per (provider, zip))
  ...NYC_SIGNAL_PROVIDERS.flatMap((provider) =>
    NYC_ZIPS.map(({ zip }) => ({ provider, zip })),
  ),
];

// Cap per (provider, zip) per run so a single sync stays bounded.
export const PER_TARGET_LIMIT = 200;
