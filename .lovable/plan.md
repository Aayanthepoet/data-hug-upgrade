## Goal

Attach `zoning_code` / `zoning_long_code` to rows produced by the 4 Philadelphia signal providers (`phl_tax_delinquent`, `phl_li_violation`, `phl_unsafe`, `phl_sheriff_deed`), then refresh existing rows by re-running the sync (the upsert path replaces zoning fields on each matched row).

## Verified against live Carto API (ZIP 19140)

| Provider table | Geometry column | `LEFT JOIN zoning_basedistricts ON ST_Intersects(z.the_geom, x.the_geom)` |
|---|---|---|
| `opa_properties_public` (used by tax_delinquent) | `the_geom` (polygon) | already verified for OPA path |
| `violations` | `the_geom` (point) | sample → `ICMX`, `ICMX`, `ICMX` |
| `li_unsafe` | `the_geom` (point) | sample → `RSA5`, `RM1`, `RM1` |
| `rtt_summary` | `the_geom` (point) | sample → `RM1`, `RSA5`, `RSA5` |

Same join shape as the OPA path. ZIP filter stays as the existing `LIKE '<zip>%'` form (we keep that for `li_unsafe`/`rtt_summary` because their `zip` is `19140-1411` style, not exact `19140`).

## Changes (only `src/lib/distress/philly-signals-provider.server.ts`)

For each of the 4 fetchers:

1. Add `z.code AS zoning_code, z.long_code AS zoning_long_code` to the SELECT.
2. Add `LEFT JOIN zoning_basedistricts z ON ST_Intersects(z.the_geom, <table>.the_geom)`.
3. Extend the row type with `zoning_code` / `zoning_long_code`.
4. Map them onto the returned record as `zoningCode` / `zoningLongCode`.

Existing WHERE clauses, ORDER BY, LIMIT, distress-type mappings, `sourceRecordId` shape, address/owner cleanup — all unchanged.

`tax_delinquent` already joins `opa_properties_public p` so we can use `p.the_geom` directly (same as OPA path) — no extra table.

`fetchPhillySignal` switch, `PHILLY_SIGNAL_DISTRESS_TYPE`, `PHILLY_SIGNAL_PER_TARGET_LIMIT`, the cache layer, and `cartoQuery` — all untouched.

## Backfill (no separate SQL)

The 1,937 existing Philly rows are keyed on `(user_id, source_provider, source_record_id)`. Re-running the sync calls the same upsert path; every row that comes back with a populated `zoning_code` will overwrite the current null. A standalone DB backfill is not possible — the zoning data lives only on the Carto API, not in our DB — so re-syncing is the backfill.

## Not touched

`philly-provider.server.ts` (OPA path), NYC providers, NYC signals, search, CSV import, scorer, billing, auth, sync orchestrator / fan-out / retry, cron schedule, schema, RLS, `sync-config`, UI filter chips.

## After applying

1. Trigger the sync via the existing fan-out hook (no code change to the orchestrator).
2. Confirm `count(zoning_code)` is > 0 across the 4 `phl_*` providers in `public.properties`.
3. Sample a "Two+ permitted" search (RM*/RTA*/RMX*/CMX*) over Philly ZIPs and confirm it returns rows.

## Risk

Spatial join cost: ~200 rows per (provider, zip) with one `ST_Intersects` lookup each — already proven on the OPA path with the same `LEFT JOIN zoning_basedistricts` clause, well under the 50 s per-provider budget. If any individual provider goes over budget the existing per-provider timeout + fallback handles it; we are not changing that.
