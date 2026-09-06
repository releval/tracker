import type { Event as UbiEvent } from "../types";
import { ClientIdEnricher } from "./ClientIdEnricher";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("ClientIdEnricher", () => {
  it("sets client_id from provider", () => {
    const enricher = new ClientIdEnricher(() => "client-abc");
    const event = createEvent();

    enricher.enrich(event);

    expect(event.client_id).toBe("client-abc");
  });

  it("does not override existing client_id", () => {
    const enricher = new ClientIdEnricher(() => "new-client");
    const event = createEvent({ client_id: "existing-client" });

    enricher.enrich(event);

    expect(event.client_id).toBe("existing-client");
  });
});
