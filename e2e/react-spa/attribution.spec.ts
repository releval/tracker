import { expect, test } from "@playwright/test";
import {
  getReactEventDetail,
  getReactEventLogEntries,
  waitForReactEvent,
  waitForReactTracker,
} from "../helpers/event-log";

const QUERY_ID = /"query_id":\s*"([^"]+)"/;

// The claim under test: a result click inside <SearchResults> records
// object-keyed attribution, and conversion events for the same product on
// LATER routes resolve the originating query_id automatically.
test.describe("Cross-route attribution", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/catalog");
    await waitForReactTracker(page);
  });

  test("a result click's attribution follows the product to later routes", async ({
    page,
  }) => {
    await page.locator("#catalog-search").fill("audio");
    await page.locator("#catalog-search").press("Enter");
    await waitForReactEvent(page, "EVENT", "search");

    const searchDetail = await getReactEventDetail(page, "EVENT", "search");
    const queryId = searchDetail.match(QUERY_ID)?.[1];
    expect(queryId).toBeTruthy();

    // Click the first search result (emits the result click and records
    // attribution), navigating to the product route.
    await page.locator("[data-product-card]").first().click();
    await page.waitForURL(/\/product\//);

    // The product view resolves the recorded attribution.
    await waitForReactEvent(page, "EVENT", "view");
    const viewDetail = await getReactEventDetail(page, "EVENT", "view");
    expect(viewDetail.match(QUERY_ID)?.[1]).toBe(queryId);

    // And so does the conversion.
    await page.locator("[data-add-to-cart]").first().click();
    await waitForReactEvent(page, "EVENT", "add_to_cart");
    const addDetail = await getReactEventDetail(page, "EVENT", "add_to_cart");
    expect(addDetail.match(QUERY_ID)?.[1]).toBe(queryId);
  });

  test("a grid-direct add-to-cart (no result click) still carries the query", async ({
    page,
  }) => {
    await page.locator("#catalog-search").fill("audio");
    await page.locator("#catalog-search").press("Enter");
    await waitForReactEvent(page, "EVENT", "search");
    const searchDetail = await getReactEventDetail(page, "EVENT", "search");
    const queryId = searchDetail.match(QUERY_ID)?.[1];
    expect(queryId).toBeTruthy();

    await page.locator("[data-add-to-cart]").first().click();
    await waitForReactEvent(page, "EVENT", "add_to_cart");
    const addDetail = await getReactEventDetail(page, "EVENT", "add_to_cart");
    expect(addDetail.match(QUERY_ID)?.[1]).toBe(queryId);
    expect(addDetail).toContain('"ordinal": 1');
    // The extra key on the call rode along as a custom event attribute.
    expect(addDetail).toContain('"category"');
  });

  test("a card outside a search context sends no result click", async ({
    page,
  }) => {
    // The catalog without a search has no <SearchResults> context: clicking
    // a card navigates but must not emit an unjoinable click event.
    await page.locator("[data-product-card]").first().click();
    await page.waitForURL(/\/product\//);
    await waitForReactEvent(page, "EVENT", "view");

    const entries = await getReactEventLogEntries(page);
    const clicks = entries.filter(
      (e) => e.type === "EVENT" && e.message === "click",
    );
    expect(clicks).toHaveLength(0);
  });
});
