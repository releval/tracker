import { defineConfig, devices } from "@playwright/test";

// Local escape hatch: if Playwright's pinned Chromium revision can't be
// downloaded (flaky sandbox network), point at any complete local build via
// PLAYWRIGHT_CHROMIUM_EXECUTABLE. CI leaves it unset and uses the normal install.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

/**
 * Integration test config: boots a real Releval stack (Postgres + ClickHouse +
 * the releval/releval image) via Testcontainers in globalSetup, then runs both a
 * Node-level spec (drives the tracker's BatchSink over real HTTP) and a browser
 * spec (loads the built IIFE tracker and clicks a result). Separate from the
 * example e2e config so the heavy Docker run stays opt-in (`npm run test:integration`).
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  // Containers are a single shared lifecycle; run specs serially against them.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Booting the image + pulling can take a while on a cold machine.
  timeout: 120_000,
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
  },
  // Serve the repo root at a fixed origin so the browser fixture can load the
  // built IIFE (../src/tracker/dist/...) and the Site's allowed_origins can
  // be registered statically (see PAGE_ORIGIN in harness.ts).
  webServer: {
    command: "npx http-server -p 4180 -s",
    cwd: "..",
    port: 4180,
    reuseExistingServer: !process.env.CI,
  },
});
