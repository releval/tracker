import { ulid } from "ulidx";
import type { Logger } from "../logging";

/**
 * Configuration for the SessionManager, which handles automatic session ID rotation based
 * on inactivity timeout and maximum session duration. The Tracker creates a SessionManager
 * internally - these options are exposed via `TrackerOptions.sessionInactivityTimeoutMs`
 * and `TrackerOptions.maxSessionDurationMs`.
 */
export type SessionManagerOptions = {
  storage: Storage;
  /** Milliseconds of inactivity before rotating the session. Default: 30 minutes. */
  inactivityTimeoutMs?: number;
  /** Maximum session duration in milliseconds. Default: 24 hours. */
  maxSessionDurationMs?: number;
  /** Logger for storage diagnostics. */
  logger?: Logger;
};

interface SessionData {
  id: string;
  createdAt: number;
  lastActivity: number;
}

const SESSION_KEY = "_ubi_session_";

// Tolerate small clock differences between tabs and devices; anything further
// in the future is corrupt or from a skewed clock and cannot be trusted (a
// far-future lastActivity would pin the session alive forever).
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Manages session IDs with inactivity timeout and maximum duration.
 */
export class SessionManager {
  private readonly storage: Storage;
  private readonly inactivityTimeoutMs: number;
  private readonly maxSessionDurationMs: number;
  private readonly logger?: Logger;
  private session: SessionData;

  constructor(options: SessionManagerOptions) {
    this.storage = options.storage;
    this.inactivityTimeoutMs = options.inactivityTimeoutMs ?? THIRTY_MINUTES;
    this.maxSessionDurationMs =
      options.maxSessionDurationMs ?? TWENTY_FOUR_HOURS;
    this.logger = options.logger;
    this.session = this.loadOrCreate();
  }

  get sessionId(): string {
    // Reconcile with storage first, so tabs converge on the session another tab
    // rotated to, and a session stays alive as long as any tab is active
    // (rather than each tab ping-ponging its own in-memory copy back to storage).
    this.syncFromStorage();
    if (this.isExpired()) {
      this.rotate();
    }
    return this.session.id;
  }

  private syncFromStorage(): void {
    try {
      const stored = this.storage.getItem(SESSION_KEY);
      if (!stored) return;
      const data: SessionData = JSON.parse(stored);
      if (!this.isUsable(data, Date.now())) return;
      // Adopt a different session (another tab rotated) or a newer heartbeat of
      // the same session (another tab kept it alive).
      if (
        data.id !== this.session.id ||
        data.lastActivity > this.session.lastActivity
      ) {
        this.session = data;
      }
    } catch {
      // Ignore corrupt storage; keep the in-memory session.
    }
  }

  /** Update the last activity timestamp. Call on every event. */
  touch(): void {
    this.session.lastActivity = Date.now();
    this.persist();
  }

  /**
   * Marks user activity that is not an event: reconciles with storage,
   * rotates if genuinely expired, then refreshes the activity timestamp.
   * Called from `Tracker.start()` so that on a classic multi-page site every
   * page load counts as a hit - the GA-style 30-minute convention - instead
   * of only dispatched events keeping the session alive. Without it, reading
   * a product page for 31 minutes rotates the session and drops attribution.
   */
  activity(): void {
    void this.sessionId;
    this.touch();
  }

  /** True when stored session data is well-formed and temporally sane. */
  private isUsable(data: SessionData, now: number): boolean {
    return (
      typeof data.id === "string" &&
      data.id.length > 0 &&
      Number.isFinite(data.createdAt) &&
      Number.isFinite(data.lastActivity) &&
      data.createdAt <= now + MAX_CLOCK_SKEW_MS &&
      data.lastActivity <= now + MAX_CLOCK_SKEW_MS
    );
  }

  private isExpired(): boolean {
    const now = Date.now();
    const inactivityExpired =
      now - this.session.lastActivity > this.inactivityTimeoutMs;
    const maxDurationExpired =
      now - this.session.createdAt > this.maxSessionDurationMs;
    return inactivityExpired || maxDurationExpired;
  }

  private rotate(): void {
    this.session = this.createSession();
    this.persist();
  }

  private loadOrCreate(): SessionData {
    try {
      const stored = this.storage.getItem(SESSION_KEY);
      if (stored) {
        const data: SessionData = JSON.parse(stored);
        if (this.isUsable(data, Date.now())) {
          return data;
        }
      }
    } catch {
      // Corrupted data, create fresh session
    }
    const session = this.createSession();
    this.persist(session);
    return session;
  }

  private createSession(): SessionData {
    const now = Date.now();
    return {
      id: ulid(),
      createdAt: now,
      lastActivity: now,
    };
  }

  private persist(session?: SessionData): void {
    try {
      this.storage.setItem(
        SESSION_KEY,
        JSON.stringify(session ?? this.session),
      );
    } catch (e) {
      // A blocked or full storage (the retry queue shares the same origin
      // quota) must not break tracking; the in-memory session keeps working
      // for the life of this page.
      this.logger?.error("Error persisting the session: ", e);
    }
  }
}
