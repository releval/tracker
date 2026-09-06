import { DefaultDispatcher } from "./dispatcher";
import type { Enricher } from "./enrichers";
import type { Sink } from "./sinks";
import type { Event as UbiEvent } from "./types";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("DefaultDispatcher", () => {
  it("applies enrichers in order then emits to sink", () => {
    const callOrder: string[] = [];
    const enricher1: Enricher = {
      enrich: jest.fn(() => callOrder.push("enricher1")),
    };
    const enricher2: Enricher = {
      enrich: jest.fn(() => callOrder.push("enricher2")),
    };
    const sink: Sink = {
      emit: jest.fn(() => callOrder.push("sink")),
    };

    const dispatcher = new DefaultDispatcher(
      new Set([enricher1, enricher2]),
      sink,
    );
    const event = createEvent();

    dispatcher.dispatch(event);

    expect(enricher1.enrich).toHaveBeenCalledWith(event);
    expect(enricher2.enrich).toHaveBeenCalledWith(event);
    expect(sink.emit).toHaveBeenCalledWith(event);
    expect(callOrder).toEqual(["enricher1", "enricher2", "sink"]);
  });

  it("continues enriching when an enricher throws", () => {
    const enricher1: Enricher = {
      enrich: jest.fn().mockImplementation(() => {
        throw new Error("boom");
      }),
    };
    const enricher2: Enricher = {
      enrich: jest.fn(),
    };
    const sink: Sink = { emit: jest.fn() };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const dispatcher = new DefaultDispatcher(
      new Set([enricher1, enricher2]),
      sink,
      logger,
    );
    dispatcher.dispatch(createEvent());

    expect(logger.error).toHaveBeenCalledWith(
      "Error enriching event: ",
      expect.any(Error),
    );
    expect(enricher2.enrich).toHaveBeenCalled();
    expect(sink.emit).toHaveBeenCalled();
  });

  it("logs error when sink throws", () => {
    const sink: Sink = {
      emit: jest.fn().mockImplementation(() => {
        throw new Error("sink error");
      }),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const dispatcher = new DefaultDispatcher(new Set(), sink, logger);
    dispatcher.dispatch(createEvent());

    expect(logger.error).toHaveBeenCalledWith(
      "Error emitting event to sink: ",
      expect.any(Error),
    );
  });

  it("does not throw when no logger is configured", () => {
    const sink: Sink = {
      emit: jest.fn().mockImplementation(() => {
        throw new Error("fail");
      }),
    };

    const dispatcher = new DefaultDispatcher(new Set(), sink);

    expect(() => dispatcher.dispatch(createEvent())).not.toThrow();
  });

  it("exposes logger property", () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const dispatcher = new DefaultDispatcher(
      new Set(),
      { emit: jest.fn() },
      logger,
    );

    expect(dispatcher.logger).toBe(logger);
  });

  it("sets timestamp when missing", () => {
    const sink: Sink = { emit: jest.fn() };
    const dispatcher = new DefaultDispatcher(new Set(), sink);

    const event: UbiEvent = { action_name: "click" };
    dispatcher.dispatch(event);

    expect(event.timestamp).toBeDefined();
    expect(typeof event.timestamp).toBe("string");
  });

  it("preserves explicit timestamp", () => {
    const sink: Sink = { emit: jest.fn() };
    const dispatcher = new DefaultDispatcher(new Set(), sink);

    const event = createEvent({ timestamp: "2025-06-01T12:00:00.000Z" });
    dispatcher.dispatch(event);

    expect(event.timestamp).toBe("2025-06-01T12:00:00.000Z");
  });

  it("initializes event_attributes when missing", () => {
    const sink: Sink = { emit: jest.fn() };
    const dispatcher = new DefaultDispatcher(new Set(), sink);

    const event: UbiEvent = { action_name: "click" };
    dispatcher.dispatch(event);

    expect(event.event_attributes).toEqual({
      event_id: expect.any(String),
      tracker: { version: "dev" },
    });
  });

  it("preserves existing event_attributes", () => {
    const sink: Sink = { emit: jest.fn() };
    const dispatcher = new DefaultDispatcher(new Set(), sink);

    const event = createEvent({
      event_attributes: {
        object: { object_id: "123", object_id_type: "product" },
      },
    });
    dispatcher.dispatch(event);

    expect(event.event_attributes!.object!.object_id).toBe("123");
  });

  it("stamps a unique event_attributes.event_id on each event", () => {
    const sink: Sink = { emit: jest.fn() };
    const dispatcher = new DefaultDispatcher(new Set(), sink);

    const e1 = createEvent();
    const e2 = createEvent();
    dispatcher.dispatch(e1);
    dispatcher.dispatch(e2);

    // Under event_attributes, because the server's TrackEvent DTO drops
    // unknown top-level fields but preserves unknown attribute fields.
    expect(e1.event_attributes!.event_id).toBeTruthy();
    expect(e2.event_attributes!.event_id).toBeTruthy();
    expect(e1.event_attributes!.event_id).not.toBe(
      e2.event_attributes!.event_id,
    );
  });

  it("does not overwrite an existing event_attributes.event_id", () => {
    const sink: Sink = { emit: jest.fn() };
    const dispatcher = new DefaultDispatcher(new Set(), sink);

    const event = createEvent({ event_attributes: { event_id: "preset" } });
    dispatcher.dispatch(event);

    expect(event.event_attributes!.event_id).toBe("preset");
  });

  it("stamps the tracker version on each event", () => {
    const sink: Sink = { emit: jest.fn() };
    const dispatcher = new DefaultDispatcher(new Set(), sink);

    const event = createEvent();
    dispatcher.dispatch(event);

    expect(event.event_attributes!.tracker).toEqual({ version: "dev" });
  });
});
