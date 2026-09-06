import { test, expect } from "@playwright/test";
import { waitForReactTracker, waitForReactEvent } from "../helpers/event-log";

test.describe("Cart and Checkout Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("full purchase flow", async ({ page }) => {
    // 1. Navigate to catalog and add item
    await page.goto("/catalog");
    await waitForReactTracker(page);
    await page.locator("[data-add-to-cart]").first().click();

    // 2. Navigate to cart via SPA link (pushState, not full page load)
    await page.locator('a[href="/cart"]').first().click();
    await page.waitForURL("/cart");

    // Verify cart has item
    await expect(
      page.locator("button").filter({ hasText: "Remove" }).first(),
    ).toBeVisible();

    // 3. Proceed to checkout
    await page.locator("text=Proceed to Checkout").click();
    await page.waitForURL("/checkout");

    await waitForReactEvent(page, "EVENT", "begin_checkout");

    // 4. Fill form — fill city/zip before address so they're populated on blur
    await page.locator('input[placeholder="John Doe"]').fill("Test User");
    await page
      .locator('input[placeholder="john@example.com"]')
      .fill("test@example.com");
    await page.locator('input[placeholder="San Francisco"]').fill("Testville");
    await page.locator('input[placeholder="94102"]').fill("12345");
    await page.locator("#address").fill("123 Test St");
    await page.locator("#address").blur();

    await waitForReactEvent(page, "EVENT", "add_shipping_info");

    // 5. Place order
    await page
      .locator('button[type="submit"]')
      .filter({ hasText: "Place Order" })
      .click();

    await waitForReactEvent(page, "EVENT", "purchase");
    await expect(page.locator("text=Order Confirmed!")).toBeVisible();
  });

  test("empty cart shows empty state", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator("text=Your cart is empty.")).toBeVisible();
  });

  test("remove from cart dispatches event", async ({ page }) => {
    // Add item first
    await page.goto("/catalog");
    await waitForReactTracker(page);
    await page.locator("[data-add-to-cart]").first().click();

    // Go to cart via SPA link
    await page.locator('a[href="/cart"]').first().click();
    await page.waitForURL("/cart");

    await page
      .locator("button")
      .filter({ hasText: "Remove" })
      .first()
      .click();

    await waitForReactEvent(page, "EVENT", "remove_from_cart");
  });
});
