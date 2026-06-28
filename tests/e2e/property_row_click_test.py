"""End-to-end test: clicking a property row on /app/properties navigates to
/app/properties/{id} and renders the property detail page.

Run:
    python3 tests/e2e/property_row_click_test.py

Required env (auto-injected in the Lovable sandbox when signed in):
    LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
    LOVABLE_BROWSER_SUPABASE_SESSION_JSON
Optional:
    BASE_URL (default http://localhost:8080)

Exits 0 on pass, 1 on failure, 2 on missing session.
"""
import asyncio
import os
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")

DETAIL_RE = re.compile(r"/app/properties/([0-9a-f-]{36})(?:[/?#].*)?$", re.I)


async def main() -> int:
    if not STORAGE_KEY or not SESSION_JSON:
        print("Missing LOVABLE_BROWSER_SUPABASE_* env vars — sign in via the preview first.")
        return 2

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        try:
            # Establish localhost origin, then inject Supabase session
            await page.goto(BASE_URL, wait_until="domcontentloaded")
            await page.evaluate(
                "([k, v]) => window.localStorage.setItem(k, v)",
                [STORAGE_KEY, SESSION_JSON],
            )

            # Open Properties list
            await page.goto(f"{BASE_URL}/app/properties", wait_until="domcontentloaded")
            await page.wait_for_load_state("networkidle")

            # First non-empty property row
            row = page.locator('[data-testid="property-row"], tbody tr').first
            await row.wait_for(state="visible", timeout=15_000)

            # Click row and assert URL changes to /app/properties/{id}
            await row.click()
            await page.wait_for_url(DETAIL_RE, timeout=15_000, wait_until="commit")

            m = DETAIL_RE.search(page.url)
            assert m, f"URL did not match detail route: {page.url}"
            prop_id = m.group(1)

            await page.wait_for_load_state("networkidle")
            await page.locator('[data-testid="property-detail"], h1, h2').first.wait_for(
                state="visible", timeout=10_000
            )

            body_text = (await page.locator("body").inner_text()).strip()
            assert len(body_text) > 50, "Detail page appears blank"
            assert not re.search(
                r"Import Leads", body_text[:500], re.I
            ), "Still on list view (Import Leads visible at top)"

            assert not errors, "Runtime errors on detail page:\n" + "\n".join(errors)

            print(f"PASS — navigated to /app/properties/{prop_id}")
            return 0
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL — {exc}")
            try:
                Path("/tmp/browser").mkdir(parents=True, exist_ok=True)
                await page.screenshot(path="/tmp/browser/property-row-click-failure.png")
            except Exception:
                pass
            return 1
        finally:
            await browser.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
