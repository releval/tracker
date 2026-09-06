import type { Event as UbiEvent } from "../types";
import { OptionsEnricher } from "./OptionsEnricher";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("OptionsEnricher", () => {
  it("sets application from the configured values", () => {
    const enricher = new OptionsEnricher({
      application: "my-app",
      userId: () => undefined,
    });
    const event = createEvent();

    enricher.enrich(event);

    expect(event.application).toBe("my-app");
  });

  it("sets user_id from the getter", () => {
    const enricher = new OptionsEnricher({
      application: "my-app",
      userId: () => "user-123",
    });
    const event = createEvent();

    enricher.enrich(event);

    expect(event.user_id).toBe("user-123");
  });

  it("reads user_id at enrich time, so a change applies to later events", () => {
    let current: string | undefined;
    const enricher = new OptionsEnricher({
      application: "my-app",
      userId: () => current,
    });

    const before = createEvent();
    enricher.enrich(before);
    current = "user-123";
    const after = createEvent();
    enricher.enrich(after);

    expect(before.user_id).toBeUndefined();
    expect(after.user_id).toBe("user-123");
  });

  it("sets site_id when configured", () => {
    const enricher = new OptionsEnricher({
      application: "my-app",
      siteId: "site-1",
      userId: () => undefined,
    });
    const event = createEvent();

    enricher.enrich(event);

    expect(event.site_id).toBe("site-1");
  });

  it("does not override existing application", () => {
    const enricher = new OptionsEnricher({
      application: "my-app",
      userId: () => undefined,
    });
    const event = createEvent({ application: "existing-app" });

    enricher.enrich(event);

    expect(event.application).toBe("existing-app");
  });

  it("does not override existing user_id", () => {
    const enricher = new OptionsEnricher({
      application: "my-app",
      userId: () => "options-user",
    });
    const event = createEvent({ user_id: "existing-user" });

    enricher.enrich(event);

    expect(event.user_id).toBe("existing-user");
  });

  it("does not set user_id when the getter yields nothing", () => {
    const enricher = new OptionsEnricher({
      application: "my-app",
      userId: () => undefined,
    });
    const event = createEvent();

    enricher.enrich(event);

    expect(event.user_id).toBeUndefined();
  });
});
