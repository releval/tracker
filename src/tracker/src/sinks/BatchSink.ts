import type { Logger } from "../logging";
import type { Event as UbiEvent } from "../types";
import type { Sink } from "./Sink";

/**
 * Configuration for the BatchSink, which queues events and sends them in bulk for better
 * network efficiency. This is the default sink when `endpointHost` is set in TrackerOptions.
 * Supports automatic retries with exponential backoff, persistent retry queues across page
 * reloads, and reliable delivery via the Beacon API on page unload.
 */
export type BatchSinkOptions = {
  /**
   * Base URL of the API endpoint (e.g., "https://api.example.com"). A path
   * prefix for a reverse proxy is allowed; the fixed Releval track-event
   * path is appended.
   */
  readonly endpointHost: string;
  /** Maximum events per batch before auto-flush. Defaults to 30. */
  readonly flushSize?: number;
  /** Milliseconds between automatic flushes. Defaults to 1000. */
  readonly flushIntervalMs?: number;
  /** Maximum retry attempts for failed batches. Defaults to 5. */
  readonly maxRetries?: number;
  /** Base delay in ms for exponential backoff. Defaults to 1000. */
  readonly retryBaseDelayMs?: number;
  /** Maximum delay in ms for exponential backoff. Defaults to 30000. */
  readonly retryMaxDelayMs?: number;
  /** Storage for persisting the retry queue across page reloads. Defaults to localStorage. */
  readonly storage?: Storage;
  /** Logger for internal diagnostics. */
  readonly logger?: Logger;
};

interface RetryBatch {
  events: UbiEvent[];
  attempt: number;
  /** Persist time (epoch ms). */
  ts: number;
}

// Prefix of the persisted retry-queue key; the sanitized endpoint is
// appended per instance, so two trackers (or a consumer-built BatchSink
// pointed at another host) can never drain each other's batches.
const STORAGE_KEY = "_ubi_batch_retry_";

// The Releval track-event path is fixed. A reverse-proxy prefix belongs on
// endpointHost itself (e.g. "https://shop.example.com/releval").
const TRACK_EVENT_PATH = "/api/v1/ubi/track-event";

// Bound the persisted retry queue so a long outage cannot grow an unbounded
// on-device log of full event payloads: the newest batches win, and anything
// older than a day is dropped on read.
const MAX_PERSISTED_BATCHES = 10;
const MAX_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * A sink that batches events, retries failures with exponential backoff,
 * and uses the Beacon API for reliable delivery on page unload.
 */
export class BatchSink implements Sink {
  private readonly url: string;
  private readonly storageKey: string;
  private readonly flushSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly storage?: Storage;
  private readonly logger?: Logger;

  private queue: UbiEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  // Pending retry batches keyed by their timer, so they can be persisted (not
  // lost) if the page unloads mid-backoff. `ts` is stamped at persist time.
  private readonly pendingRetries = new Map<
    ReturnType<typeof setTimeout>,
    Omit<RetryBatch, "ts">
  >();
  private disposed = false;

  private readonly boundOnVisibilityChange: () => void;
  private readonly boundOnPageHide: (event: PageTransitionEvent) => void;

  constructor(options: BatchSinkOptions) {
    const {
      endpointHost,
      flushSize = 30,
      flushIntervalMs = 1000,
      maxRetries = 5,
      retryBaseDelayMs = 1000,
      retryMaxDelayMs = 30000,
      storage,
      logger,
    } = options;

    this.url = `${endpointHost.replace(/\/+$/, "")}${TRACK_EVENT_PATH}`;
    this.storageKey = `${STORAGE_KEY}${endpointHost.replace(/[^a-zA-Z0-9]+/g, "-")}_`;
    this.flushSize = flushSize;
    this.flushIntervalMs = flushIntervalMs;
    this.maxRetries = maxRetries;
    this.retryBaseDelayMs = retryBaseDelayMs;
    this.retryMaxDelayMs = retryMaxDelayMs;
    this.storage = storage;
    this.logger = logger;

    this.boundOnVisibilityChange = this.onVisibilityChange.bind(this);
    this.boundOnPageHide = this.onPageHide.bind(this);

    this.start();
    this.drainStoredRetries();
  }

  /**
   * Add an event to the batch queue. Triggers a flush if the queue reaches flushSize.
   */
  emit(event: UbiEvent): void {
    if (this.disposed) return;

    this.queue.push(event);

    if (this.queue.length >= this.flushSize) {
      this.flush();
    }
  }

  /**
   * Flush the current queue immediately via fetch.
   * Returns a promise that resolves when the batch is sent (or scheduled for retry).
   */
  flush(): Promise<void> {
    if (this.queue.length === 0) return Promise.resolve();

    const batch = this.queue;
    this.queue = [];

    return this.sendBatch(batch, 0);
  }

  /**
   * Start the flush timer and unload listeners.
   */
  start(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);

    // visibilitychange covers most navigations on Chrome/Firefox/Android;
    // pagehide is the event Safari/iOS fire on same-tab navigation, so both
    // are needed to reliably capture the terminal click. Neither forfeits the
    // back/forward cache the way unload/beforeunload would.
    if (typeof document !== "undefined") {
      document.addEventListener(
        "visibilitychange",
        this.boundOnVisibilityChange,
      );
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", this.boundOnPageHide);
    }
  }

  /**
   * Stop the flush timer, flush remaining events, and clean up.
   */
  dispose(): void {
    this.disposed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Persist any in-flight retry batches so they are not lost on teardown.
    this.persistPendingRetries();

    if (typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        this.boundOnVisibilityChange,
      );
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.boundOnPageHide);
    }

    // Best-effort flush of remaining events
    if (this.queue.length > 0) {
      this.sendViaBeacon(this.queue);
      this.queue = [];
    }
  }

  /** Visible for testing - returns the current queue length */
  get pendingCount(): number {
    return this.queue.length;
  }

  private onVisibilityChange(): void {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      // hidden is the last callback guaranteed to run before a backgrounded tab
      // may be frozen and discarded (mobile Chrome/Android can discard without
      // ever firing pagehide), so flush the queue and persist in-flight retries
      // here too, not only on pagehide.
      this.flushViaBeacon();
      this.persistPendingRetries();
    } else if (document.visibilityState === "visible") {
      // The page came back rather than being discarded; resume the persisted
      // retries in memory. drainStoredRetries clears storage first, so a later
      // load does not also replay them (no duplicate).
      this.drainStoredRetries();
    }
  }

  private onPageHide(event: PageTransitionEvent): void {
    this.flushViaBeacon();
    // On a real unload (not bfcache), in-memory retry timers will die with the
    // page, so persist any pending retry batches for the next page load. On a
    // bfcache entry (event.persisted) the page may resume with its timers
    // intact, so do not persist (that would duplicate on resume).
    if (!event.persisted) {
      this.persistPendingRetries();
    }
  }

  /**
   * Clear and persist any in-flight retry batches so a page discard or unload
   * does not lose them. Empties the map, so it is safe to call more than once.
   */
  private persistPendingRetries(): void {
    for (const [timer, batch] of this.pendingRetries) {
      clearTimeout(timer);
      this.persistForRetry(batch.events, batch.attempt);
    }
    this.pendingRetries.clear();
  }

  /**
   * Flush all queued events using the Beacon API (reliable on page unload).
   */
  private flushViaBeacon(): void {
    if (this.queue.length === 0) return;

    const batch = this.queue;
    this.queue = [];
    this.sendViaBeacon(batch);
  }

  private sendViaBeacon(events: UbiEvent[]): void {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      try {
        const blob = new Blob([JSON.stringify({ events })], {
          type: "application/json",
        });
        // sendBeacon returns false when the UA refuses to queue the beacon
        // (over the ~64KiB cap, too many pending beacons). Fall through to the
        // keepalive fetch in that case rather than silently dropping the batch.
        if (navigator.sendBeacon(this.url, blob)) {
          this.logger?.info(
            `ubi: queued ${events.length} event(s) via beacon to ${this.url}`,
          );
          return;
        }
      } catch (e) {
        this.logger?.error("Beacon API failed: ", e);
      }
    }

    this.sendViaKeepaliveFetch(events);
  }

  /**
   * Fallback delivery on unload when the beacon is unavailable or refused.
   * Persists the batch for the next page load if the fetch fails.
   */
  private sendViaKeepaliveFetch(events: UbiEvent[]): void {
    try {
      fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
      })
        .then((response) => {
          if (!response.ok) {
            this.persistForRetry(events, 0);
          }
        })
        .catch(() => {
          this.persistForRetry(events, 0);
        });
    } catch (e) {
      this.logger?.error("Keepalive fetch failed: ", e);
      this.persistForRetry(events, 0);
    }
  }

  private async sendBatch(events: UbiEvent[], attempt: number): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        // Routine flushes use a normal fetch. keepalive is reserved for the
        // unload path (sendViaKeepaliveFetch): keepalive request bodies share a
        // small (~64KiB) browser-wide budget that sustained batching plus
        // retries would exceed, making fetch reject and silently churn batches.
        // The terminal flush during navigation is covered by the unload beacon.
      });

      if (!response.ok) {
        if (this.isRetryable(response.status)) {
          this.scheduleRetry(events, attempt);
        } else {
          this.logger?.error(
            `Batch send failed with status ${response.status}, not retrying`,
          );
        }
      } else {
        this.logger?.info(
          `ubi: sent ${events.length} event(s) to ${this.url} (${response.status})`,
        );
      }
    } catch (_e) {
      // Network error - retryable
      this.scheduleRetry(events, attempt);
    }
  }

  private isRetryable(status: number): boolean {
    return status >= 500 || status === 429;
  }

  private scheduleRetry(events: UbiEvent[], attempt: number): void {
    if (this.disposed) {
      this.persistForRetry(events, attempt);
      return;
    }

    if (attempt >= this.maxRetries) {
      this.logger?.error(
        `Batch send failed after ${this.maxRetries} attempts, discarding ${events.length} events`,
      );
      return;
    }

    const delay = this.calculateBackoff(attempt);
    this.logger?.warn(
      `Retrying batch (attempt ${attempt + 1}/${this.maxRetries}) in ${delay}ms`,
    );

    const timer = setTimeout(() => {
      this.pendingRetries.delete(timer);
      this.sendBatch(events, attempt + 1);
    }, delay);
    this.pendingRetries.set(timer, { events, attempt });
  }

  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.retryBaseDelayMs * 2 ** attempt;
    const cappedDelay = Math.min(exponentialDelay, this.retryMaxDelayMs);
    // Full jitter: a value in [0, cappedDelay]. This keeps clients from
    // retrying in lockstep (a biased-high "cap + jitter" collapses to exactly
    // the cap for every client once the cap is reached - a thundering herd).
    return Math.random() * cappedDelay;
  }

  private persistForRetry(events: UbiEvent[], attempt: number): void {
    if (!this.storage) return;

    try {
      const stored = this.loadStoredRetries();
      stored.push({ events, attempt, ts: Date.now() });
      const bounded = stored.slice(-MAX_PERSISTED_BATCHES);
      if (bounded.length < stored.length) {
        this.logger?.warn(
          `ubi: dropped ${stored.length - bounded.length} oldest persisted retry batch(es) (cap ${MAX_PERSISTED_BATCHES})`,
        );
      }
      this.storage.setItem(this.storageKey, JSON.stringify(bounded));
    } catch (e) {
      this.logger?.error("Failed to persist retry queue: ", e);
    }
  }

  private loadStoredRetries(): RetryBatch[] {
    if (!this.storage) return [];

    try {
      const data = this.storage.getItem(this.storageKey);
      const parsed: unknown = data ? JSON.parse(data) : [];
      if (!Array.isArray(parsed)) return [];
      return (parsed as RetryBatch[]).filter(
        (batch) =>
          Array.isArray(batch?.events) &&
          typeof batch?.ts === "number" &&
          Date.now() - batch.ts <= MAX_PERSISTED_AGE_MS,
      );
    } catch {
      return [];
    }
  }

  private drainStoredRetries(): void {
    if (!this.storage) return;

    const batches = this.loadStoredRetries();
    if (batches.length === 0) return;

    // Clear storage immediately to prevent duplicate processing across tabs
    this.storage.removeItem(this.storageKey);

    this.logger?.info(
      `ubi: resuming ${batches.length} persisted retry batch(es)`,
    );

    for (const batch of batches) {
      this.sendBatch(batch.events, batch.attempt);
    }
  }
}
