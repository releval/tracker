import type { Event as UbiEvent } from "./../types";
import type { Enricher } from "./Enricher";

/**
 * Enriches the event with information about the page:
 * - url
 * - title
 * - referrer
 */
export class PageEnricher implements Enricher {
  enrich(event: UbiEvent): void {
    if (!event.event_attributes) {
      event.event_attributes = {};
    }

    event.event_attributes.page = {
      ...event.event_attributes.page,
      url: location.href,
      title: document.title,
      referrer: document.referrer || "",
    };
  }
}
