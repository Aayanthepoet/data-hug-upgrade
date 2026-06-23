## Purchase Contracts (PDF + DB + e-signature)

Add a "Create contract" flow on the property detail page that captures buyer/seller/price/closing, generates a PDF cash-purchase agreement, saves a `contracts` record, and (optionally) sends it via **SignWell** for e-signature.

### What gets built

1. **Database** (`contracts` table)
   - `id`, `user_id`, `property_id`, `buyer_name`, `seller_name`, `purchase_price`, `closing_date`, `status` (`draft` | `sent` | `viewed` | `signed` | `declined` | `cancelled`), `pdf_storage_path`, `signwell_document_id`, `signed_pdf_url`, `signed_at`, `created_at`, `updated_at`
   - Private storage bucket: `contracts` (user-folder scoped read)
   - RLS: owner-only CRUD; admins read all

2. **PDF generation** — `pdf-lib` (Worker-compatible, pure JS)
   - Server fn `createContract({ property_id, buyer_name, seller_name, purchase_price, closing_date, send_for_signature })`
   - Renders a clean one-page cash-purchase agreement (parties, property address, price, closing date, signature blocks)
   - Saves to storage at `contracts/{user_id}/{contract_id}.pdf`, inserts row

3. **SignWell e-signature** (opt-in toggle in the dialog)
   - Server fn calls SignWell `POST /v1/documents` with the generated PDF + two recipients (buyer/seller emails)
   - Stores `signwell_document_id`, sets `status = 'sent'`
   - Public webhook `/api/public/hooks/signwell` updates status on `document_signed`, `document_completed`, `document_declined`; downloads signed PDF into the same bucket
   - Requires you to provide `SIGNWELL_API_KEY` (free tier: 3 docs/mo) and a `SIGNWELL_WEBHOOK_SECRET` (we generate)

4. **UI on property detail page**
   - "Create contract" button → dialog with fields (buyer, seller, price [defaults to property ARV], closing date, optional buyer/seller emails + "send for e-signature" switch)
   - Below the form: list of existing contracts for this property with status badge and "Download PDF" + "Open signing link"

### Out of scope this turn

- Multiple custom fields beyond the minimal set (you picked "Minimal").
- Sequential signing, in-person signing, attachments, counter-signing flows.
- Editing a contract after it's sent for signature (cancel + recreate instead).

### Order of operations

1. Migration (table + bucket + policies) — needs your approval before code lands.
2. After approval: install `pdf-lib`, add server fns, webhook, UI dialog.
3. I'll request `SIGNWELL_API_KEY` via the secrets tool when SignWell wiring is ready; PDF + DB work independently of that key.

Approve to start with the migration.