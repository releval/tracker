import { expect, test } from "@playwright/test";
import {
  getHtmlEventLogEntries,
  waitForHtmlEvent,
  waitForHtmlTracker,
} from "../helpers/event-log";

// The claim under test: clicking a search result records object-keyed
// attribution, and conversion events for that object on LATER pages -
// across full document navigations - resolve the originating query_id
// and ordinal automatically.
test.describe("Cross-page attribution", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("index.html");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await waitForHtmlTracker(page);
  });

  test("a result click's attribution follows the product to the next page", async ({
    page,
  }) => {
    await page.locator("#search-input").fill("audio");
    await page.locator('#search-form button[type="submit"]').click();
    await expect(page.locator("#product-grid")).toHaveAttribute(
      "data-query-id",
      /.+/,
    );
    const queryId = await page
      .locator("#product-grid")
      .getAttribute("data-query-id");

    const firstCard = page
      .locator("[data-query-id] [data-object-id]")
      .first();
    const objectId = await firstCard.getAttribute("data-object-id");

    // A real navigation: the click event is beaconed/logged, the product
    // page builds a brand-new Tracker, and only the attribution store
    // carries the link.
    await firstCard.click();
    await page.waitForURL(/product\.html/);
    await waitForHtmlTracker(page);

    await waitForHtmlEvent(page, "EVENT", "view");
    const entries = await getHtmlEventLogEntries(page);
    const view = entries
      .filter((e) => e.type === "EVENT" && e.message === "view")
      .find((e) => e.detail?.includes(objectId!));
    expect(view).toBeDefined();
    expect(view!.detail).toContain(queryId!);
    expect(view!.detail).toContain('"ordinal": 1');

    // The conversion on this page resolves the same attribution.
    await page.locator("#add-to-cart-btn").click();
    await waitForHtmlEvent(page, "EVENT", "add_to_cart");
    const add = (await getHtmlEventLogEntries(page))
      .filter((e) => e.type === "EVENT" && e.message === "add_to_cart")
      .find((e) => e.detail?.includes(objectId!));
    expect(add).toBeDefined();
    expect(add!.detail).toContain(queryId!);
  });

  test("a related product visited from an attributed page stays unattributed", async ({
    page,
  }) => {
    await page.locator("#search-input").fill("audio");
    await page.locator('#search-form button[type="submit"]').click();
    await expect(page.locator("#product-grid")).toHaveAttribute(
      "data-query-id",
      /.+/,
    );

    const firstCard = page
      .locator("[data-query-id] [data-object-id]")
      .first();
    await firstCard.click();
    await page.waitForURL(/product\.html/);
    await waitForHtmlTracker(page);
    await waitForHtmlEvent(page, "EVENT", "view");

    // Click a related product card: it sits outside any results container,
    // so it is not a result click, and the next page's view must not borrow
    // the earlier query - attribution is per object, never per page.
    const related = page.locator(".related-grid [data-object-id]").first();
    const relatedId = await related.getAttribute("data-object-id");
    await related.click();
    await page.waitForURL(new RegExp(`product\\.html\\?id=${relatedId}`));
    await waitForHtmlTracker(page);

    await expect
      .poll(async () => {
        const entries = await getHtmlEventLogEntries(page);
        return entries.some(
          (e) =>
            e.type === "EVENT" &&
            e.message === "view" &&
            e.detail?.includes(relatedId!),
        );
      })
      .toBe(true);

    const entries = await getHtmlEventLogEntries(page);
    const view = entries
      .filter((e) => e.type === "EVENT" && e.message === "view")
      .find((e) => e.detail?.includes(relatedId!));
    expect(view!.detail).not.toContain('"query_id"');
  });
});
