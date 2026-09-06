import { test, expect } from "@playwright/test";
import {
  waitForHtmlTracker,
  waitForHtmlEvent,
} from "../helpers/event-log";

/** Seed the cart in localStorage so we don't need to click add-to-cart (which navigates away on the catalog page). */
async function seedCart(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "relevaltech-cart",
      JSON.stringify([{ productId: "NT-001", quantity: 1 }]),
    );
  });
}

test.describe("Cart and Checkout Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("index.html");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("full purchase flow: checkout and place order", async ({ page }) => {
    // 1. Seed cart with an item
    await seedCart(page);

    // 2. Navigate to checkout
    await page.goto("checkout.html");
    await waitForHtmlTracker(page);
    await waitForHtmlEvent(page, "EVENT", "begin_checkout");

    // 3. Fill checkout form
    await page.locator("#full-name").fill("Test User");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#city").fill("Testville");
    await page.locator("#zip").fill("12345");
    await page.locator("#address").fill("123 Test St");
    await page.locator("#address").blur();

    await waitForHtmlEvent(page, "EVENT", "add_shipping_info");

    // 4. Submit order
    await page.locator(".btn-place-order").click();
    await waitForHtmlEvent(page, "EVENT", "purchase");

    // Verify success message
    await expect(page.locator(".success-message")).toBeVisible();
    await expect(page.locator(".order-id")).toBeVisible();
  });

  test("empty cart shows empty state", async ({ page }) => {
    await page.goto("cart.html");
    await waitForHtmlTracker(page);
    await expect(page.locator(".empty-cart")).toBeVisible();
  });

  test("remove from cart dispatches remove_from_cart event", async ({
    page,
  }) => {
    // Seed cart with an item
    await seedCart(page);

    // Go to cart
    await page.goto("cart.html");
    await waitForHtmlTracker(page);

    // Remove item
    await page.locator("[data-remove]").first().click();
    await waitForHtmlEvent(page, "EVENT", "remove_from_cart");
  });
});
