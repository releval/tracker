import { expect, test } from "@playwright/test";
// Import the ACTUAL built CJS artifact so we exercise exactly what ships to npm.
// @ts-expect-error - importing the built bundle by path; types resolve via .d.cts at runtime.
import { BatchSink } from "../src/tracker/dist/releval-tracker.cjs";
import { readHarnessInfo, waitForEvent } from "./harness";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear() {
      m.clear();
    },
    getItem(k: string) {
      return m.get(k) ?? null;
    },
    key(i: number) {
      return Array.from(m.keys())[i] ?? null;
    },
    removeItem(k: string) {
      m.delete(k);
    },
    setItem(k: string, v: string) {
      m.set(k, v);
    },
  };
}

test("BatchSink delivers an event to a real Releval and it lands in ClickHouse", async () => {
  const info = readHarnessInfo();
  // A unique query_id for this event. It does not need a matching ubi_queries
  // row to be ingested - this test is purely about the wire contract.
  const queryId = `node-${Math.random().toString(36).slice(2)}`;

  const sink = new BatchSink({
    endpointHost: info.appBaseUrl,
    storage: memoryStorage(),
  });

  const event = {
    action_name: "click",
    timestamp: new Date().toISOString(),
    application: "integration-test",
    site_id: info.siteId,
    query_id: queryId,
    session_id: "sess-node",
    client_id: "client-node",
    event_attributes: {
      position: { ordinal: 1 },
      object: { object_id: "NT-001", object_id_field: "product_id" },
      // Custom event attributes: the server must preserve unknown keys of
      // any JSON type into the ClickHouse JSON column.
      badge: "sale",
      sale_price: 9.99,
      flags: { clearance: true },
    },
  };

  sink.emit(event);
  await sink.flush();

  const row = await waitForEvent(info.clickHouseUrl, queryId);
  expect(row.action_name).toBe("click");
  expect(row.site_id).toBe(info.siteId);
  expect(row.query_id).toBe(queryId);
  expect(row.attrs).toContain('"badge"');
  expect(row.attrs).toContain("9.99");
  expect(row.attrs).toContain('"clearance"');

  sink.dispose();
});
