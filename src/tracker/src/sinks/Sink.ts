import type { Event as UbiEvent } from "../types";

/**
 * A destination that receives enriched UBI events. Built-in sinks send events to an API
 * endpoint (BatchSink) or to the browser console (ConsoleSink). Implement this
 * interface to send events to a custom destination and register via `tracker.addSink()`.
 */
export interface Sink {
  /**
   * Emit the specified event to the destination.
   * @remarks Implementations should allow errors to propagate. These are logged by the configured tracker logger.
   * @param event The event to emit
   */
  emit(event: UbiEvent): void;
}
