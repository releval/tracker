import type { Event as UbiEvent } from "../types";
import type { Sink } from "./Sink";

/**
 * Logs every event to the browser console. The development default: used
 * automatically when no `endpointHost` is configured and no sink has been
 * added, so events are visible without anything leaving the page. With an
 * endpoint configured, delivery goes through `BatchSink` instead.
 */
export class ConsoleSink implements Sink {
  emit(event: UbiEvent): void {
    console.log(event);
  }
}
