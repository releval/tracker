import { test, expect } from "@playwright/test";
import { waitForReactTracker, waitForReactEvent } from "../helpers/event-log";

test.describe("Catalog Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/catalog");
    await waitForReactTracker(page);
  });

  test("product cards render with data attributes", async ({ page }) => {
    const cards = page.locator("[data-product-card]");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    await expect(cards.first()).toHaveAttribute("data-product-id");
    await expect(cards.first()).toHaveAttribute("data-position", "1");
  });

  test("clicking a product card navigates to product page", async ({
    page,
  }) => {
    const firstCard = page.locator("[data-product-card]").first();
    const productId = await firstCard.getAttribute("data-product-id");

    await firstCard.click();
    await page.waitForURL(/\/product\//);
    expect(page.url()).toContain(`/product/${productId}`);
  });

  test("add-to-cart button generates add_to_cart event", async ({ page }) => {
    await page.locator("[data-add-to-cart]").first().click();
    await waitForReactEvent(page, "EVENT", "add_to_cart");
  });
});
