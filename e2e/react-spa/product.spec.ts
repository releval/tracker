import { expect, test } from "@playwright/test";
import { waitForReactEvent, waitForReactTracker } from "../helpers/event-log";

test.describe("Product Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/catalog");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await waitForReactTracker(page);
  });

  test("product page dispatches view event after SPA navigation", async ({
    page,
  }) => {
    await page.locator("[data-product-card]").first().click();
    await page.waitForURL(/\/product\//);
    await waitForReactEvent(page, "EVENT", "view");
  });

  test("a hard load of the product route still delivers the mount-effect view", async ({
    page,
  }) => {
    // React runs the page's mount effect BEFORE the provider's start()
    // effect on a hard load; the tracker buffers the dispatch and replays
    // it at start(), so the event must still appear.
    await page.goto("/product/NT-001");
    await waitForReactTracker(page);
    await waitForReactEvent(page, "EVENT", "view");
  });

  test("add-to-cart on product page dispatches add_to_cart event", async ({
    page,
  }) => {
    await page.locator("[data-product-card]").first().click();
    await page.waitForURL(/\/product\//);

    await page.locator("[data-add-to-cart]").first().click();
    await waitForReactEvent(page, "EVENT", "add_to_cart");
  });

  test("related products are displayed", async ({ page }) => {
    await page.locator("[data-product-card]").first().click();
    await page.waitForURL(/\/product\//);

    await expect(page.locator("text=Related Products").first()).toBeVisible();
    const related = page.locator("[data-product-card]");
    const count = await related.count();
    expect(count).toBeGreaterThan(0);
  });
});
