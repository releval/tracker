import { expect, test } from "@playwright/test";
import {
  PAGE_ORIGIN,
  readHarnessInfo,
  waitForEvent,
  waitForQuery,
} from "./harness";

test("the built browser tracker delivers a result click to Releval with the server-issued query_id", async ({
  page,
}) => {
  const info = readHarnessInfo();

  const url =
    `${PAGE_ORIGIN}/integration/fixtures/tracker-page.html` +
    `?endpoint=${encodeURIComponent(info.appBaseUrl)}` +
    `&siteId=${encodeURIComponent(info.siteId)}` +
    `&queryId=${encodeURIComponent(info.queryId)}` +
    `&query=${encodeURIComponent(info.query)}`;

  await page.goto(url);
  await page.waitForFunction(
    () => (window as unknown as { __trackerReady?: boolean }).__trackerReady,
  );

  await page.click("#result");

  // The event crosses a real cross-origin boundary (page origin -> container),
  // through the real BatchSink fetch path, and lands in ClickHouse.
  const row = await waitForEvent(info.clickHouseUrl, info.queryId, "click");
  expect(row.action_name).toBe("click");
  expect(row.site_id).toBe(info.siteId);
  expect(row.query_id).toBe(info.queryId);
  // The retry-dedup key persists where the server keeps unknown attribute
  // fields; a top-level event_id would have been silently dropped.
  expect(row.attrs).toContain('"event_id"');
  expect(row.attrs).toContain('"ordinal"');

  // trackSearch emitted a canonical search event for the same query, so a
  // query with no clicks still leaves a row for abandonment analysis.
  const search = await waitForEvent(info.clickHouseUrl, info.queryId, "search");
  expect(search.action_name).toBe("search");
  // The wire contract, not just the client: message_type QUERY survives
  // delivery and lands in the row.
  expect(search.message_type).toBe("QUERY");

  // A conversion dispatched WITHOUT a queryId resolves the recorded
  // attribution: the object-keyed store, proved against the real stack.
  await page.click("#convert");
  const conversion = await waitForEvent(
    info.clickHouseUrl,
    info.queryId,
    "add_to_cart",
  );
  expect(conversion.query_id).toBe(info.queryId);
  expect(conversion.attrs).toContain('"ordinal"');

  // Prove the attribution join: the server-issued query_id resolves to its query text.
  const query = await waitForQuery(info.clickHouseUrl, info.queryId);
  expect(query.user_query).toBe(info.query);
});

test("a result click that navigates away still reaches Releval", async ({
  page,
}) => {
  const info = readHarnessInfo();
  // Its own query_id so the assertion cannot pick up a click from another test.
  const queryId = `nav-${Date.now()}`;

  const url =
    `${PAGE_ORIGIN}/integration/fixtures/tracker-nav-page.html` +
    `?endpoint=${encodeURIComponent(info.appBaseUrl)}` +
    `&siteId=${encodeURIComponent(info.siteId)}` +
    `&queryId=${encodeURIComponent(queryId)}` +
    `&query=${encodeURIComponent("smart watch")}`;

  await page.goto(url);
  await page.waitForFunction(
    () => (window as unknown as { __trackerReady?: boolean }).__trackerReady,
  );

  // The terminal click: the anchor navigates, so the event is queued and the
  // page is gone microseconds later. Delivery has to happen on the unload path.
  await Promise.all([
    page.waitForURL(/destination\.html/),
    page.click("#result-link"),
  ]);
  await expect(page.locator("#destination")).toBeVisible();

  // A navigator.sendBeacon carrying an application/json Blob is dropped
  // cross-origin after reporting success, which silently loses exactly this
  // event - the one every click-through rate is computed from.
  const row = await waitForEvent(info.clickHouseUrl, queryId, "click");
  expect(row.action_name).toBe("click");
  expect(row.site_id).toBe(info.siteId);
  expect(row.attrs).toContain('"NT-002"');
  expect(row.attrs).toContain('"ordinal"');
});
