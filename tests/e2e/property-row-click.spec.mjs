/**
 * End-to-end test: clicking a row on /app/properties navigates to
 * /app/properties/{id} and renders the property detail page.
 *
 * Run:
 *   node tests/e2e/property-row-click.spec.mjs
 *
 * Required env (auto-provided in Lovable sandbox when signed in):
 *   LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
 *   LOVABLE_BROWSER_SUPABASE_SESSION_JSON
 * Optional:
 *   BASE_URL (default http://localhost:8080)
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;

if (!storageKey || !sessionJson) {
  console.error(
    "Missing LOVABLE_BROWSER_SUPABASE_* env vars — sign in via the preview first.",
  );
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1800 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  // Establish localhost origin, then inject Supabase session
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [storageKey, sessionJson],
  );

  // Open Properties list
  await page.goto(`${BASE_URL}/app/properties`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");

  // Find the first property row (rendered as a <tr> with data-testid or role=row)
  const row = page
    .locator('[data-testid="property-row"], tbody tr')
    .filter({ hasNot: page.locator("text=No properties") })
    .first();
  await row.waitFor({ state: "visible", timeout: 15_000 });

  // Click row (non-link area) and assert URL changes to /app/properties/{id}
  await row.click();
  await page.waitForURL(/\/app\/properties\/[0-9a-f-]{36}/i, {
    timeout: 10_000,
  });

  const url = new URL(page.url());
  const match = url.pathname.match(/^\/app\/properties\/([0-9a-f-]{36})$/i);
  assert.ok(match, `URL did not match detail route: ${page.url()}`);
  const id = match[1];

  // Detail page rendered — wait for heading / address area
  await page.waitForLoadState("networkidle");
  const detailMarker = page
    .locator('[data-testid="property-detail"], h1, h2')
    .first();
  await detailMarker.waitFor({ state: "visible", timeout: 10_000 });

  // Sanity: page is not blank and not the list anymore
  const bodyText = (await page.locator("body").innerText()).trim();
  assert.ok(bodyText.length > 50, "Detail page appears blank");
  assert.ok(
    !/Import Leads/i.test(bodyText.slice(0, 500)),
    "Still on list view (Import Leads visible at top)",
  );

  assert.equal(
    errors.length,
    0,
    `Runtime errors on detail page:\n${errors.join("\n")}`,
  );

  console.log(`PASS — navigated to /app/properties/${id}`);
} catch (err) {
  console.error("FAIL —", err.message);
  await page.screenshot({ path: "/tmp/property-row-click-failure.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
