import type { Event as UbiEvent } from "./../types";
import type { Enricher } from "./Enricher";

/**
 * Enriches the event with information about the browser:
 * - user_agent
 * - language
 * - screen resolution
 * - webdriver (only when set: the one cheap automation signal, so analysis
 *   can filter bot and headless traffic that would distort CTR)
 */
export class BrowserEnricher implements Enricher {
  enrich(event: UbiEvent): void {
    if (!event.event_attributes) {
      event.event_attributes = {};
    }

    const browser: Record<string, unknown> = {
      ...event.event_attributes.browser,
      user_agent: navigator.userAgent,
      language: navigator.language,
      resolution: {
        width: screen.width,
        height: screen.height,
      },
    };
    if (navigator.webdriver) {
      browser.webdriver = true;
    }

    event.event_attributes.browser = browser;
  }
}
