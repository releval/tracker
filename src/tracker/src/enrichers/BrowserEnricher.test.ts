import type { Event as UbiEvent } from "../types";
import { BrowserEnricher } from "./BrowserEnricher";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("BrowserEnricher", () => {
  it("adds browser info to event_attributes", () => {
    const enricher = new BrowserEnricher();
    const event = createEvent();

    enricher.enrich(event);

    expect(event.event_attributes!.browser).toEqual({
      user_agent: navigator.userAgent,
      language: navigator.language,
      resolution: { width: screen.width, height: screen.height },
    });
  });

  it("initializes event_attributes if missing", () => {
    const enricher = new BrowserEnricher();
    const event = createEvent();
    (event as any).event_attributes = undefined;

    enricher.enrich(event);

    expect(event.event_attributes).toBeDefined();
    expect(event.event_attributes!.browser).toBeDefined();
  });

  it("stamps webdriver: true when navigator.webdriver is set", () => {
    // Shadow the prototype getter with an own property, then remove the
    // shadow again so other tests see the real value.
    Object.defineProperty(navigator, "webdriver", {
      value: true,
      configurable: true,
    });
    try {
      const enricher = new BrowserEnricher();
      const event = createEvent();
      enricher.enrich(event);

      expect(event.event_attributes!.browser.webdriver).toBe(true);
    } finally {
      Reflect.deleteProperty(navigator, "webdriver");
    }
  });

  it("does not stamp webdriver when it is not set", () => {
    const enricher = new BrowserEnricher();
    const event = createEvent();
    enricher.enrich(event);

    expect(event.event_attributes!.browser.webdriver).toBeUndefined();
  });

  it("preserves existing browser attributes", () => {
    const enricher = new BrowserEnricher();
    const event = createEvent();
    event.event_attributes!.browser = { custom: "value" };

    enricher.enrich(event);

    expect(event.event_attributes!.browser.custom).toBe("value");
    expect(event.event_attributes!.browser.user_agent).toBe(
      navigator.userAgent,
    );
  });
});
