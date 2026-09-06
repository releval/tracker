import { defineConfig, devices } from "@playwright/test";

// Local escape hatch: if Playwright's pinned Chromium revision can't be
// downloaded (flaky sandbox network), point at any complete local build via
// PLAYWRIGHT_CHROMIUM_EXECUTABLE. CI leaves it unset and uses the normal install.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
  },

  projects: [
    {
      name: "html-script",
      testDir: "./e2e/html-script",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4173/examples/html-script/",
      },
    },
    {
      name: "react-spa",
      testDir: "./e2e/react-spa",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:5173",
      },
    },
  ],

  webServer: [
    {
      // Serve from repo root so HTML files can access ../../src/tracker/dist/
      command: "npx http-server -p 4173 -s",
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      cwd: "examples/react-spa",
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
