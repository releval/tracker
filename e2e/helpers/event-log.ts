import { type Page, expect } from "@playwright/test";

export interface EventLogEntry {
  type: string;
  message: string;
  detail?: string;
}

// ===================================================================
// HTML Script App
// ===================================================================

export async function waitForHtmlTracker(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const entries = document.querySelectorAll(
        "#event-log-entries .event-entry",
      );
      return Array.from(entries).some((entry) => {
        const action = entry.querySelector(".entry-action");
        return action && action.textContent?.includes("Tracker ready");
      });
    },
    { timeout: 10_000 },
  );
}

export async function getHtmlEventLogEntries(
  page: Page,
): Promise<EventLogEntry[]> {
  return page.evaluate(() => {
    const entries = document.querySelectorAll(
      "#event-log-entries .event-entry",
    );
    return Array.from(entries).map((entry) => ({
      type: entry.querySelector(".entry-type")?.textContent?.trim() || "",
      message: entry.querySelector(".entry-action")?.textContent?.trim() || "",
      detail: entry.querySelector(".entry-detail")?.textContent?.trim() || "",
    }));
  });
}

export async function waitForHtmlEvent(
  page: Page,
  type: string,
  messageSubstring: string,
  timeout = 10_000,
): Promise<void> {
  await page.waitForFunction(
    ({ t, m }: { t: string; m: string }) => {
      const entries = document.querySelectorAll(
        "#event-log-entries .event-entry",
      );
      return Array.from(entries).some((entry) => {
        const entryType = entry
          .querySelector(".entry-type")
          ?.textContent?.trim();
        const entryMsg = entry
          .querySelector(".entry-action")
          ?.textContent?.trim();
        return entryType === t && entryMsg?.includes(m);
      });
    },
    { t: type, m: messageSubstring },
    { timeout },
  );
}

// ===================================================================
// React SPA
// ===================================================================

export async function waitForReactTracker(page: Page): Promise<void> {
  // Wait for the EventLog component to mount (Events button visible).
  // By this point React has committed the tree and useEffect has fired tracker.start().
  await page
    .locator("button")
    .filter({ hasText: "Events" })
    .waitFor({ state: "visible", timeout: 10_000 });
}

export async function openReactEventLog(page: Page): Promise<void> {
  const heading = page.locator("text=Event Log").first();
  const isVisible = await heading.isVisible().catch(() => false);
  if (!isVisible) {
    const eventsBtn = page.locator("button").filter({ hasText: "Events" });
    await eventsBtn.click();
    await heading.waitFor({ state: "visible" });
  }
}

export async function getReactEventLogEntries(
  page: Page,
): Promise<EventLogEntry[]> {
  await openReactEventLog(page);
  const entries = page.locator('[data-testid="event-entry"]');
  const count = await entries.count();
  const results: EventLogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const entry = entries.nth(i);
    const type =
      (await entry
        .locator('[data-testid="event-type"]')
        .textContent()) || "";
    const message =
      (await entry
        .locator('[data-testid="event-message"]')
        .textContent()) || "";
    results.push({ type: type.trim(), message: message.trim() });
  }
  return results;
}

/**
 * Returns the expanded JSON detail of the newest event-log entry matching
 * type + message. Clicks the entry to expand it and collapses it again.
 */
export async function getReactEventDetail(
  page: Page,
  type: string,
  messageSubstring: string,
): Promise<string> {
  await openReactEventLog(page);
  const entries = page.locator('[data-testid="event-entry"]');
  const count = await entries.count();
  for (let i = count - 1; i >= 0; i--) {
    const entry = entries.nth(i);
    const entryType = await entry
      .locator('[data-testid="event-type"]')
      .textContent();
    const entryMsg = await entry
      .locator('[data-testid="event-message"]')
      .textContent();
    if (entryType?.trim() === type && entryMsg?.includes(messageSubstring)) {
      await entry.click();
      const detail = await page
        .locator('[data-testid="event-detail"]')
        .textContent();
      await entry.click();
      return detail ?? "";
    }
  }
  throw new Error(
    `No event log entry of type "${type}" matching "${messageSubstring}"`,
  );
}

export async function waitForReactEvent(
  page: Page,
  type: string,
  messageSubstring: string,
  timeout = 10_000,
): Promise<void> {
  const heading = page.locator("text=Event Log").first();
  if (!(await heading.isVisible().catch(() => false))) {
    await openReactEventLog(page);
  }

  await expect(async () => {
    const entries = page.locator('[data-testid="event-entry"]');
    const count = await entries.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const entry = entries.nth(i);
      const entryType = await entry
        .locator('[data-testid="event-type"]')
        .textContent();
      const entryMsg = await entry
        .locator('[data-testid="event-message"]')
        .textContent();
      if (entryType?.trim() === type && entryMsg?.includes(messageSubstring)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  }).toPass({ timeout });
}
