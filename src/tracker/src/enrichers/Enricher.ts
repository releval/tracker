import type { Event as UbiEvent } from "./../types";

/**
 * Mutates a UBI event to add contextual data before it reaches the sink. Built-in enrichers
 * add fields like `application`, `session_id`, `client_id`, and browser metadata. Implement
 * this interface to add custom fields (e.g. A/B test variant, feature flags) and register
 * via `tracker.addEnricher()`.
 */
export interface Enricher {
  /**
   * Enriches the event.
   * @param event the event to enrich
   */
  enrich(event: UbiEvent): void;
}
