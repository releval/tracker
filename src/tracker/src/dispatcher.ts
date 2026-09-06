import { ulid } from "ulidx";
import type { Enricher } from "./enrichers";
import type { Logger } from "./logging";
import type { Sink } from "./sinks";
import type { Event as UbiEvent } from "./types";

// Injected by the build (tsdown `define`); absent under ts-jest.
declare const __TRACKER_VERSION__: string | undefined;
const TRACKER_VERSION =
  typeof __TRACKER_VERSION__ === "string" ? __TRACKER_VERSION__ : "dev";

/**
 * Receives events from collectors, runs them through enrichers, and emits them to the sink.
 * Collectors receive a Dispatcher when attached and use it to send events. Library consumers
 * do not typically implement this interface directly - the Tracker creates the appropriate
 * dispatcher internally.
 */
export interface Dispatcher {
  readonly logger?: Logger;

  dispatch(event: UbiEvent): void;
}

/**
 * Enriches events and dispatches to the sink
 */
export class DefaultDispatcher implements Dispatcher {
  readonly logger?: Logger;
  private enrichers: Set<Enricher>;
  private sink: Sink;

  constructor(enrichers: Set<Enricher>, sink: Sink, logger?: Logger) {
    this.logger = logger;
    this.sink = sink;
    this.enrichers = enrichers;
  }

  public dispatch(event: UbiEvent) {
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    if (!event.event_attributes) {
      event.event_attributes = {};
    }

    // Stamp a stable per-event id, set once at creation time, so delivery
    // retries (which can genuinely duplicate: the persisted retry queue plus
    // a beacon whose response never arrived) stay deduplicable in analysis.
    // It lives under event_attributes because the server's TrackEvent DTO
    // drops unknown top-level fields but preserves unknown attribute fields
    // into the ClickHouse JSON column.
    if (!event.event_attributes.event_id) {
      event.event_attributes.event_id = ulid();
    }

    // Which tracker build produced the row, for supportability once several
    // versions are deployed across customer sites.
    if (!event.event_attributes.tracker) {
      event.event_attributes.tracker = { version: TRACKER_VERSION };
    }

    this.enrichers.forEach((enricher) => {
      try {
        enricher.enrich(event);
      } catch (e) {
        this.logger?.error("Error enriching event: ", e);
      }
    });

    // With `debug: true` the default console logger prints this, which makes
    // it the one-line way to watch events leave the page against a server
    // that answers 202 to everything.
    this.logger?.debug("ubi: dispatching event", event);

    try {
      this.sink.emit(event);
    } catch (e) {
      this.logger?.error("Error emitting event to sink: ", e);
    }
  }
}
