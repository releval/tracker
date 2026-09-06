import { expect, test } from "@playwright/test";
import {
  getHtmlEventLogEntries,
  waitForHtmlEvent,
  waitForHtmlTracker,
} from "../helpers/event-log";

test.describe("Catalog Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("index.html");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await waitForHtmlTracker(page);
  });

  test("tracker initializes and logs ready message", async ({ page }) => {
    const entries = await getHtmlEventLogEntries(page);
    const ready = entries.find(
      (e) => e.type === "INFO" && e.message.includes("Tracker ready"),
    );
    expect(ready).toBeDefined();
  });

  test("a result click after a search carries the query_id and ordinal", async ({
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

    // Prevent navigation so we can check the event log on this page.
    await page.evaluate(() => {
      document.querySelectorAll("a").forEach((el) => {
        el.addEventListener("click", (e) => e.preventDefault(), {
          capture: true,
        });
      });
    });

    const firstCard = page
      .locator("[data-query-id] [data-object-id]")
      .first();
    const objectId = await firstCard.getAttribute("data-object-id");
    await firstCard.click();
    await waitForHtmlEvent(page, "EVENT", "click");

    const entries = await getHtmlEventLogEntries(page);
    const clickEntry = entries.find(
      (e) => e.type === "EVENT" && e.message === "click",
    );
    expect(clickEntry).toBeDefined();
    expect(clickEntry!.detail).toContain(objectId!);
    expect(clickEntry!.detail).toContain(queryId!);
    expect(clickEntry!.detail).toContain('"ordinal": 1');
    // data-event-category rode along as a custom event attribute.
    expect(clickEntry!.detail).toContain('"category"');
    // data-event-pricing arrived as a parsed JSON object, not a string.
    expect(clickEntry!.detail).toContain('"currency": "USD"');
  });

  test("an add-to-cart click emits an attributed add_to_cart and no result click", async ({
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

    await page.evaluate(() => {
      document.querySelectorAll("a").forEach((el) => {
        el.addEventListener("click", (e) => e.preventDefault(), {
          capture: true,
        });
      });
    });

    await page.locator("[data-add-to-cart]").first().click();
    await waitForHtmlEvent(page, "EVENT", "add_to_cart");

    // The nested button is on the collector's ignore list, so the click on
    // it must not ALSO be reported as a result click (that would inflate CTR).
    const entries = await getHtmlEventLogEntries(page);
    const resultClicks = entries.filter(
      (e) => e.type === "EVENT" && e.message === "click",
    );
    expect(resultClicks).toHaveLength(0);

    // The conversion carries the grid's query AND the button's own rank, so
    // a grid-direct add-to-cart is a fully joinable row.
    const addEntry = entries.find(
      (e) => e.type === "EVENT" && e.message === "add_to_cart",
    );
    expect(addEntry!.detail).toContain(queryId!);
    expect(addEntry!.detail).toContain('"ordinal": 1');
  });

  test("an add-to-cart without any search is sent unattributed", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.querySelectorAll("a").forEach((el) => {
        el.addEventListener("click", (e) => e.preventDefault(), {
          capture: true,
        });
      });
    });

    await page.locator("[data-add-to-cart]").first().click();
    await waitForHtmlEvent(page, "EVENT", "add_to_cart");

    const entries = await getHtmlEventLogEntries(page);
    const addEntry = entries.find(
      (e) => e.type === "EVENT" && e.message === "add_to_cart",
    );
    expect(addEntry).toBeDefined();
    expect(addEntry!.detail).not.toContain('"query_id"');
  });
});
