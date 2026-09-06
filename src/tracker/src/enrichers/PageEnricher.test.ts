import type { Event as UbiEvent } from "../types";
import { PageEnricher } from "./PageEnricher";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("PageEnricher", () => {
  it("adds page info to event_attributes", () => {
    const enricher = new PageEnricher();
    const event = createEvent();

    enricher.enrich(event);

    expect(event.event_attributes!.page).toEqual({
      url: location.href,
      title: document.title,
      referrer: "",
    });
  });

  it("uses empty string for missing referrer", () => {
    const enricher = new PageEnricher();
    const event = createEvent();

    enricher.enrich(event);

    expect(event.event_attributes!.page.referrer).toBe("");
  });

  it("initializes event_attributes if missing", () => {
    const enricher = new PageEnricher();
    const event = createEvent();
    (event as any).event_attributes = undefined;

    enricher.enrich(event);

    expect(event.event_attributes!.page).toBeDefined();
  });
});
