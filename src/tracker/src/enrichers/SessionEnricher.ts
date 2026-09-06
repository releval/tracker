import type { Event as UbiEvent } from "./../types";
import type { Enricher } from "./Enricher";

/**
 * Returns the current session ID, or undefined if no session is active.
 * Called by the SessionEnricher on every event to populate the `session_id` field.
 * The Tracker supplies this automatically via its SessionManager.
 */
export type SessionIdProvider = () => string | undefined;

/**
 * Enriches the event with
 * - session_id
 *
 * Optionally calls onActivity to update the session's last activity timestamp.
 */
export class SessionEnricher implements Enricher {
  private readonly sessionIdProvider: SessionIdProvider;
  private readonly onActivity?: () => void;

  constructor(sessionIdProvider: SessionIdProvider, onActivity?: () => void) {
    this.sessionIdProvider = sessionIdProvider;
    this.onActivity = onActivity;
  }

  enrich(event: UbiEvent): void {
    if (!event.session_id) {
      event.session_id = this.sessionIdProvider();
    }
    this.onActivity?.();
  }
}
