import { expect, test } from "@playwright/test";
import {
  getHtmlEventLogEntries,
  waitForHtmlEvent,
  waitForHtmlTracker,
} from "../helpers/event-log";

test.describe("Search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("index.html");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await waitForHtmlTracker(page);
  });

  test("submitting a search emits a canonical search event and filters products", async ({
    page,
  }) => {
    await page.locator("#search-input").fill("audio");
    await page.locator('#search-form button[type="submit"]').click();

    await waitForHtmlEvent(page, "EVENT", "search", 10_000);
    const entries = await getHtmlEventLogEntries(page);
    const search = entries.find(
      (e) => e.type === "EVENT" && e.message === "search",
    );
    expect(search).toBeDefined();
    expect(search!.detail).toContain('"message_type": "QUERY"');
    expect(search!.detail).toContain('"user_query": "audio"');
    expect(search!.detail).toContain("query_id");

    await expect(page.locator("#page-heading")).toContainText("audio", {
      ignoreCase: true,
    });
  });

  test("search results emit canonical impressions carrying the query_id", async ({
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

    await waitForHtmlEvent(page, "EVENT", "impression", 10_000);

    const entries = await getHtmlEventLogEntries(page);
    const impression = entries.find(
      (e) => e.type === "EVENT" && e.message === "impression",
    );
    expect(impression).toBeDefined();
    expect(impression!.detail).toContain(queryId!);
    expect(impression!.detail).toContain('"ordinal"');
    expect(impression!.detail).toContain('"object_id"');
  });
});
