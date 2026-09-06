import type { Event as UbiEvent } from "../types";
import { ConsoleSink } from "./ConsoleSink";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

describe("ConsoleSink", () => {
  it("logs the event to console", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const sink = new ConsoleSink();
    const event = createEvent();

    sink.emit(event);

    expect(consoleSpy).toHaveBeenCalledWith(event);
    consoleSpy.mockRestore();
  });
});
