import type { Event as UbiEvent } from "../types";
import type { Enricher } from "./Enricher";

/**
 * Returns a stable anonymous identifier for the current client/device.
 * Called by the ClientIdEnricher on every event to populate the `client_id` field.
 * The Tracker supplies this automatically using a ULID persisted in localStorage.
 */
export type ClientIdProvider = () => string;

/**
 * Enriches the event with
 * - client_id
 */
export class ClientIdEnricher implements Enricher {
  private readonly clientIdProvider: ClientIdProvider;

  constructor(clientIdProvider: ClientIdProvider) {
    this.clientIdProvider = clientIdProvider;
  }

  enrich(event: UbiEvent): void {
    if (!event.client_id) {
      event.client_id = this.clientIdProvider();
    }
  }
}
