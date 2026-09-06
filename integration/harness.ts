/**
 * Boots a real Releval stack (Postgres + ClickHouse + the `releval/releval` image)
 * with Testcontainers, then registers a Site and mints a server-issued query_id -
 * exactly the way a real customer backend would. The tracker under test then posts
 * to this live server and we assert the event lands in ClickHouse.
 *
 * The started containers are held in a module-level singleton so that Playwright's
 * global setup and global teardown (which run in the same Node process, in separate
 * files) share one lifecycle.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@clickhouse/client";
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

const HERE = __dirname;
const HARNESS_FILE = join(HERE, ".harness.json");

// The origin the browser fixture page is served from (see playwright.config.ts).
// Must match the Site's allowed_origins so the server accepts browser-sent events.
export const PAGE_ORIGIN = "http://localhost:4180";

const ADMIN_EMAIL = "admin@releval.local";
const ADMIN_PASSWORD = "Password1234!";
const RELEVAL_IMAGE = process.env.RELEVAL_IMAGE ?? "releval/releval:latest";

export interface HarnessInfo {
  /** Base URL of the running Releval app (host-mapped). */
  appBaseUrl: string;
  /** Host-mapped ClickHouse HTTP URL, for assertion queries. */
  clickHouseUrl: string;
  /** The registered Site's public identifier. */
  siteId: string;
  /** A real, server-issued query_id (from POST /api/v1/ubi/track-query). */
  queryId: string;
  /** The query text that produced `queryId`. */
  query: string;
}

interface Started {
  network: StartedNetwork;
  postgres: StartedTestContainer;
  clickHouse: StartedTestContainer;
  app: StartedTestContainer;
}

let started: Started | undefined;

export async function startHarness(): Promise<HarnessInfo> {
  const network = await new Network().start();

  const postgres = await new GenericContainer("postgres:18.3")
    .withNetwork(network)
    .withNetworkAliases("postgres")
    .withEnvironment({
      POSTGRES_DB: "releval",
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "postgres",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage(
        /database system is ready to accept connections/,
        2,
      ),
    )
    .start();

  const clickHouse = await new GenericContainer(
    "clickhouse/clickhouse-server:25.8.22",
  )
    .withNetwork(network)
    .withNetworkAliases("clickhouse")
    .withCopyFilesToContainer([
      {
        source: join(HERE, "clickhouse", "config.xml"),
        target: "/etc/clickhouse-server/config.d/config.xml",
      },
      {
        source: join(HERE, "clickhouse", "users.xml"),
        target: "/etc/clickhouse-server/users.d/users.xml",
      },
    ])
    .withExposedPorts(8123)
    .withWaitStrategy(Wait.forHttp("/ping", 8123).forStatusCode(200))
    .start();

  const app = await new GenericContainer(RELEVAL_IMAGE)
    .withNetwork(network)
    .withExposedPorts(8080)
    .withEnvironment({
      ACCEPT_EULA: "Y",
      ASPNETCORE_URLS: "http://+:8080",
      ConnectionStrings__Postgres:
        "Host=postgres;Port=5432;Database=releval;Username=postgres;Password=postgres",
      ConnectionStrings__ClickHouse:
        "Host=clickhouse;Port=8123;Username=default;password=;Database=default;Compression=false",
      JwtSettings__Issuer: "https://releval.co",
      JwtSettings__Audience: "https://releval.co",
      JwtSettings__ExpireTimeSpan: "01:00:00",
      RELEVAL_INITIAL_ADMIN_EMAIL: ADMIN_EMAIL,
      RELEVAL_INITIAL_ADMIN_PASSWORD: ADMIN_PASSWORD,
      MigrateOnStartup: "true",
      Logging__LogLevel__Default: "Warning",
    })
    .withWaitStrategy(
      Wait.forHttp("/.well-known/jwks.json", 8080).forStatusCode(200),
    )
    .withStartupTimeout(240_000)
    .start();

  const appBaseUrl = `http://localhost:${app.getMappedPort(8080)}`;
  const clickHouseUrl = `http://localhost:${clickHouse.getMappedPort(8123)}`;

  started = { network, postgres, clickHouse, app };

  // Authenticate as the bootstrap admin, register a Site, and mint a query_id.
  const cookie = await login(appBaseUrl);
  const siteId = await createSite(appBaseUrl, cookie);
  const query = "wireless noise cancelling headphones";
  const queryId = await trackQuery(appBaseUrl, cookie, query);

  return { appBaseUrl, clickHouseUrl, siteId, queryId, query };
}

export async function stopHarness(): Promise<void> {
  if (!started) return;
  const { network, postgres, clickHouse, app } = started;
  // Stop the app first so it releases its DB connections.
  await app.stop().catch(() => {});
  await clickHouse.stop().catch(() => {});
  await postgres.stop().catch(() => {});
  await network.stop().catch(() => {});
  started = undefined;
}

export function writeHarnessInfo(info: HarnessInfo): void {
  // Playwright workers run in separate processes, so pass connection info via a file.
  // (Written by global setup, read by specs and teardown.)
  writeFileSync(HARNESS_FILE, JSON.stringify(info, null, 2));
}

export function readHarnessInfo(): HarnessInfo {
  return JSON.parse(readFileSync(HARNESS_FILE, "utf8")) as HarnessInfo;
}

// --- HTTP helpers (the "customer backend" side: authenticated, server-to-server) ---

async function login(appBaseUrl: string): Promise<string> {
  const res = await fetch(`${appBaseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const setCookies = res.headers.getSetCookie?.() ?? [];
  // The Identity auth cookie is chunked when large (eval.auth + eval.authC1/C2),
  // so forward every cookie name=value pair, not just the first chunk.
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookieHeader.includes("eval.auth")) {
    throw new Error(
      `No eval.auth cookie in login response. Set-Cookie: ${setCookies.join(" | ")}`,
    );
  }
  return cookieHeader;
}

async function createSite(appBaseUrl: string, cookie: string): Promise<string> {
  const res = await fetch(`${appBaseUrl}/api/v1/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: `integration-${Date.now()}`,
      allowed_origins: [PAGE_ORIGIN],
    }),
  });
  if (!res.ok) {
    throw new Error(`Create site failed: ${res.status} ${await res.text()}`);
  }
  const site = (await res.json()) as { site_id: string };
  return site.site_id;
}

async function trackQuery(
  appBaseUrl: string,
  cookie: string,
  query: string,
): Promise<string> {
  const res = await fetch(`${appBaseUrl}/api/v1/ubi/track-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ application: "integration-test", user_query: query }),
  });
  if (!res.ok) {
    throw new Error(`Track query failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { query_id: string };
  return body.query_id;
}

// --- ClickHouse assertion helper ---

export interface UbiEventRow {
  action_name: string;
  site_id: string;
  query_id: string;
  application: string;
  /** UBI message_type (e.g. "QUERY" on search events); empty when unset. */
  message_type: string;
  /** The event_attributes JSON column, serialised, for containment checks. */
  attrs: string;
}

/**
 * Polls `ubi_events` until a row with the given query_id appears, or times out.
 * Ingestion is async/batched (~2s flush) plus async insert, so retry for a while.
 */
export async function waitForEvent(
  clickHouseUrl: string,
  queryId: string,
  actionName?: string,
  timeoutMs = 20_000,
): Promise<UbiEventRow> {
  const client = createClient({
    url: clickHouseUrl,
    username: "default",
    password: "",
  });
  const deadline = Date.now() + timeoutMs;
  try {
    for (;;) {
      const rs = await client.query({
        query:
          "SELECT action_name, site_id, query_id, application, message_type, toString(event_attributes) AS attrs " +
          "FROM ubi_events WHERE query_id = {qid:String}" +
          (actionName ? " AND action_name = {an:String}" : "") +
          " LIMIT 1",
        query_params: { qid: queryId, an: actionName ?? "" },
        format: "JSONEachRow",
      });
      const rows = (await rs.json()) as UbiEventRow[];
      if (rows.length > 0) return rows[0];
      if (Date.now() > deadline) {
        throw new Error(
          `No ubi_events row with query_id=${queryId} after ${timeoutMs}ms`,
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    await client.close();
  }
}

export interface UbiQueryRow {
  query_id: string;
  user_query: string;
}

/** Polls `ubi_queries` for the server-issued query_id, to prove the join back to query text. */
export async function waitForQuery(
  clickHouseUrl: string,
  queryId: string,
  timeoutMs = 20_000,
): Promise<UbiQueryRow> {
  const client = createClient({
    url: clickHouseUrl,
    username: "default",
    password: "",
  });
  const deadline = Date.now() + timeoutMs;
  try {
    for (;;) {
      const rs = await client.query({
        query:
          "SELECT query_id, user_query FROM ubi_queries WHERE query_id = {qid:String} LIMIT 1",
        query_params: { qid: queryId },
        format: "JSONEachRow",
      });
      const rows = (await rs.json()) as UbiQueryRow[];
      if (rows.length > 0) return rows[0];
      if (Date.now() > deadline) {
        throw new Error(
          `No ubi_queries row with query_id=${queryId} after ${timeoutMs}ms`,
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    await client.close();
  }
}
