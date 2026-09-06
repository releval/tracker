import type { Event as UbiEvent } from "../types";
import { SessionEnricher } from "./SessionEnricher";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("SessionEnricher", () => {
  it("sets session_id from provider", () => {
    const enricher = new SessionEnricher(() => "session-abc");
    const event = createEvent();

    enricher.enrich(event);

    expect(event.session_id).toBe("session-abc");
  });

  it("does not override existing session_id", () => {
    const enricher = new SessionEnricher(() => "new-session");
    const event = createEvent({ session_id: "existing-session" });

    enricher.enrich(event);

    expect(event.session_id).toBe("existing-session");
  });

  it("handles undefined from provider", () => {
    const enricher = new SessionEnricher(() => undefined);
    const event = createEvent();

    enricher.enrich(event);

    expect(event.session_id).toBeUndefined();
  });

  it("calls onActivity callback on each enrich", () => {
    const onActivity = jest.fn();
    const enricher = new SessionEnricher(() => "session-abc", onActivity);
    const event = createEvent();

    enricher.enrich(event);

    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  it("works without onActivity callback", () => {
    const enricher = new SessionEnricher(() => "session-abc");
    const event = createEvent();

    expect(() => enricher.enrich(event)).not.toThrow();
  });
});
