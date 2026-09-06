import type { Event as UbiEvent } from "../types";
import { AggregateSink } from "./AggregateSink";
import type { Sink } from "./Sink";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("AggregateSink", () => {
  it("emits to all sinks", () => {
    const sink1: Sink = { emit: jest.fn() };
    const sink2: Sink = { emit: jest.fn() };
    const aggregate = new AggregateSink(new Set([sink1, sink2]), undefined);
    const event = createEvent();

    aggregate.emit(event);

    expect(sink1.emit).toHaveBeenCalledWith(event);
    expect(sink2.emit).toHaveBeenCalledWith(event);
  });

  it("continues emitting to other sinks when one throws", () => {
    const sink1: Sink = {
      emit: jest.fn().mockImplementation(() => {
        throw new Error("fail");
      }),
    };
    const sink2: Sink = { emit: jest.fn() };
    const aggregate = new AggregateSink(new Set([sink1, sink2]), undefined);

    aggregate.emit(createEvent());

    expect(sink2.emit).toHaveBeenCalled();
  });

  it("logs errors when a sink fails", () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const sink1: Sink = {
      emit: jest.fn().mockImplementation(() => {
        throw new Error("fail");
      }),
    };
    const aggregate = new AggregateSink(new Set([sink1]), logger);

    aggregate.emit(createEvent());

    expect(logger.error).toHaveBeenCalled();
  });

  it("can remove sinks dynamically", () => {
    const sink1: Sink = { emit: jest.fn() };
    const sink2: Sink = { emit: jest.fn() };
    const aggregate = new AggregateSink(new Set([sink1, sink2]), undefined);

    aggregate.delete(sink2);
    aggregate.emit(createEvent());

    expect(sink1.emit).toHaveBeenCalled();
    expect(sink2.emit).not.toHaveBeenCalled();
  });

  it("can add sinks dynamically", () => {
    const sink1: Sink = { emit: jest.fn() };
    const sink2: Sink = { emit: jest.fn() };
    const aggregate = new AggregateSink(new Set([sink1]), undefined);

    aggregate.add(sink2);
    aggregate.emit(createEvent());

    expect(sink1.emit).toHaveBeenCalled();
    expect(sink2.emit).toHaveBeenCalled();
  });
});
