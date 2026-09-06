import { expect, test } from "@playwright/test";
import {
  getReactEventDetail,
  waitForReactEvent,
  waitForReactTracker,
} from "../helpers/event-log";

test.describe("Search and Impressions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/catalog");
    await waitForReactTracker(page);
  });

  test("submitting a search emits a canonical search event", async ({
    page,
  }) => {
    await page.locator("#catalog-search").fill("audio");
    await page.locator("#catalog-search").press("Enter");

    await waitForReactEvent(page, "EVENT", "search", 10_000);
    const detail = await getReactEventDetail(page, "EVENT", "search");
    expect(detail).toContain('"message_type": "QUERY"');
    expect(detail).toContain('"user_query": "audio"');
    expect(detail).toContain("query_id");
    expect(page.url()).toContain("q=audio");
  });

  test("search results generate canonical impression events", async ({
    page,
  }) => {
    await page.locator("#catalog-search").fill("audio");
    await page.locator("#catalog-search").press("Enter");

    await expect(page.locator("[data-product-card]").first()).toBeVisible({
      timeout: 5000,
    });

    await waitForReactEvent(page, "EVENT", "impression", 10_000);
    const detail = await getReactEventDetail(page, "EVENT", "impression");
    expect(detail).toContain('"query_id"');
    expect(detail).toContain('"ordinal"');
    expect(detail).toContain('"object_id"');
  });
});
