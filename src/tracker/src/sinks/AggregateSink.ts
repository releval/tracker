import type { Logger } from "../logging";
import type { Event as UbiEvent } from "../types";
import type { Sink } from "./Sink";

/**
 * Emits events to multiple sinks
 */
export class AggregateSink implements Sink {
  private sinks: Set<Sink>;
  private readonly logger?: Logger;

  constructor(sinks: Set<Sink>, logger?: Logger) {
    this.sinks = sinks;
    this.logger = logger;
  }

  public add(sink: Sink) {
    this.sinks.add(sink);
  }

  public delete(sink: Sink) {
    this.sinks.delete(sink);
  }

  emit(data: UbiEvent): void {
    this.sinks.forEach((sink) => {
      try {
        sink.emit(data);
      } catch (error) {
        this.logger?.error("Error emitting event to sink", {
          error,
          sink,
          data,
        });
      }
    });
  }
}
