import type { Event as UbiEvent } from "./../types";
import type { Enricher } from "./Enricher";

/**
 * The values the OptionsEnricher stamps. `application` and `siteId` are fixed
 * at construction; `userId` is a getter so {@link Tracker.setUserId} takes
 * effect on events dispatched after the call (the same late-binding pattern
 * as the session and client id enrichers). Holding copied values rather than
 * the caller's options object also closes the accidental lever where
 * mutating the passed options after construction silently changed events.
 */
export type OptionsEnricherValues = {
  application: string;
  siteId?: string;
  userId: () => string | undefined;
};

/**
 * Enriches the event with configured values:
 * - application
 * - user_id (late-bound via the getter)
 * - siteId (stamped as `site_id` on the event)
 */
export class OptionsEnricher implements Enricher {
  private readonly values: OptionsEnricherValues;

  constructor(values: OptionsEnricherValues) {
    this.values = values;
  }

  enrich(data: UbiEvent): void {
    if (!data.application) {
      data.application = this.values.application;
    }

    const userId = this.values.userId();
    if (!data.user_id && userId) {
      data.user_id = userId;
    }

    // site_id is a Releval extension to the upstream UBI schema, declared in
    // scripts/schema-overrides.json so it is typed on Event like any other field.
    if (!data.site_id && this.values.siteId) {
      data.site_id = this.values.siteId;
    }
  }
}
