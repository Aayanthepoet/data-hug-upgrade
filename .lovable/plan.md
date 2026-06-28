# CSV Lead Import for Properties

A new "Import Leads (CSV)" flow on `/app/properties` that lets users upload their own foreclosure/REO/distress lists, map columns, and push them into the existing `properties` table so they immediately work with scoring, contacts, outreach, and Vision.

## User flow

1. On `/app/properties`, a new **Import Leads (CSV)** button sits next to **Add Property** and **Search Properties**, plus a small **Download sample CSV template** link.
2. Click → dialog opens.
   - Step 1 — Upload: drag/drop or pick a `.csv` (≤ 5 MB, ≤ 5,000 rows).
   - Step 2 — Map columns: detected headers on the left, our fields on the right with auto-guessed mappings the user can change. Preview first 5 rows.
   - Step 3 — Import: progress, then a summary card.
3. Summary shows: total rows, imported (new), updated (existing), skipped, and a scrollable list of failed rows with the reason. A "Download error report" button exports the failed rows + reasons as CSV.

## Our fields + auto-detect aliases

| Field | Required | Common aliases auto-mapped |
|---|---|---|
| address | ✅ | "address", "property address", "site address", "street", "street address", "property" |
| city | (city+state OR zip) | "city", "town", "municipality" |
| state | (city+state OR zip) | "state", "st", "province" |
| zip | (city+state OR zip) | "zip", "zipcode", "postal code", "postal" |
| owner_name | – | "owner", "owner 1", "owner name", "owner1", "current owner" |
| owner_mailing_address | – | "mailing address", "owner address", "owner mailing" |
| distress_type | – | "status", "distress", "distress type", "type", "stage" |
| estimated_value | – | "value", "estimated value", "list price", "price", "avm", "market value" |
| beds | – | "beds", "bedrooms", "br" |
| baths | – | "baths", "bathrooms", "ba" |
| notes | – | "notes", "comments", "remarks" |

Distress normalization (case-insensitive):
- `reo`, `bank owned`, `foreclosed` → `reo`
- `pre-foreclosure`, `preforeclosure`, `nod`, `lis pendens` → `preforeclosure`
- `auction`, `sheriff sale`, `trustee sale` → `auction`
- `tax lien` → `tax_lien`
- `tax delinquent` → `tax_delinquent`
- `vacant` → `vacant`
- `absentee` → `absentee`
- anything else / missing → `unknown` (honest default — not guessed)

## Dedupe + upsert

- `source_provider = 'user_csv'`
- `source_record_id = normalize(address) + '|' + zip` (lowercase, collapse whitespace, strip punctuation).
- Reuses the existing unique key `(user_id, source_provider, source_record_id)` → same list re-uploaded = updates, not duplicates.
- Because `source_provider` is part of the conflict key, rows from `nyc_opendata`, `philly_carto`, `attom`, or null (manual) are never touched.

## Implementation

**New files**
- `src/lib/csv/parse.ts` — tiny pure CSV parser (RFC 4180-ish: quoted fields, escaped quotes, CRLF, BOM strip, trim). No new dependency.
- `src/lib/csv/mapping.ts` — header aliases, distress normalization, address normalization for dedupe key, row → record transform, validation (`address` required, `zip` OR (`city`+`state`) required).
- `src/lib/csv/import-csv.functions.ts` — `importLeadsCsv` server fn (subscription-gated). Accepts `{ rows, mapping }`, validates each row, builds upsert rows with `source_provider='user_csv'`, chunks (200/batch), returns `{ total, imported, updated, skipped, errors: [{row, reason}] }`. Uses `count: 'exact'` on a pre-check to distinguish imported vs updated.
- `src/components/properties/ImportLeadsDialog.tsx` — 3-step dialog (Upload → Map → Result). Uses `<Dialog>`, `<Select>` per field, preview table, summary view.
- `public/sample-leads.csv` — small example template.

**Edits**
- `src/routes/_authenticated/app.properties.index.tsx` — add the button + sample link in the header row; mount `<ImportLeadsDialog>`.

**Reuse**
- Same upsert shape and conflict key as `importDistressedProperties` → scoring, contacts, outreach, Vision all work automatically.
- Subscription middleware already applied to the existing import path; the new server fn uses the same.

## Out of scope

- No new tables, RLS, or migrations (existing `properties` schema + unique key already covers it).
- No billing / auth changes.
- `ENABLE_ATTOM` stays false.
- No background job — synchronous import is fine at 5k-row cap; we can add a queue later if needed.
