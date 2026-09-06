import { expect, test } from "@playwright/test";
import {
  getHtmlEventLogEntries,
  waitForHtmlEvent,
  waitForHtmlTracker,
} from "../helpers/event-log";

test.describe("Product Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("index.html");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("a direct visit dispatches a canonical view without attribution", async ({
    page,
  }) => {
    await page.goto("product.html?id=NT-001");
    await waitForHtmlTracker(page);

    await waitForHtmlEvent(page, "EVENT", "view");
    const entries = await getHtmlEventLogEntries(page);
    const viewEntry = entries.find(
      (e) => e.type === "EVENT" && e.message === "view",
    );
    expect(viewEntry).toBeDefined();
    expect(viewEntry!.detail).toContain('"object_id": "NT-001"');
    // No search led here, so inventing a query link would poison the data.
    expect(viewEntry!.detail).not.toContain('"query_id"');
  });

  test("add-to-cart on the product page dispatches add_to_cart", async ({
    page,
  }) => {
    await page.goto("product.html?id=NT-001");
    await waitForHtmlTracker(page);

    await page.locator("#add-to-cart-btn").click();
    await waitForHtmlEvent(page, "EVENT", "add_to_cart");

    const entries = await getHtmlEventLogEntries(page);
    const addEntry = entries.find(
      (e) => e.type === "EVENT" && e.message === "add_to_cart",
    );
    expect(addEntry).toBeDefined();
    expect(addEntry!.detail).toContain("NT-001");
  });
});
