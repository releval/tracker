import {
  type AttributionRecord,
  AttributionStore,
} from "./attribution/AttributionStore";
import {
  type Collector,
  type Detach,
  type ResolvedResultClick,
  ResultClickCollector,
  ResultImpressionCollector,
  type TrackResultClicksOptions,
  type TrackResultImpressionsOptions,
} from "./collectors";
import { DefaultDispatcher, type Dispatcher } from "./dispatcher";
import {
  BrowserEnricher,
  ClientIdEnricher,
  type Enricher,
  OptionsEnricher,
  PageEnricher,
  SessionEnricher,
} from "./enrichers";
import { ConsoleLogger, type Logger, safeLogger } from "./logging";
import { AggregateSink, BatchSink, ConsoleSink, type Sink } from "./sinks";
import {
  getOrCreateClientId,
  initLocalStorage,
  initSessionStorage,
  SessionManager,
} from "./storage";
import type { Event as UbiEvent } from "./types";
import { isValidOrdinal } from "./utils";

// Bounds the pre-start buffer (dispatches before start() are replayed at
// start()); beyond it the oldest buffered events are dropped with a warning.
const PRE_START_BUFFER_LIMIT = 100;

// Bounds the per-instance impression dedup set (one entry per reported
// queryId+objectId pair). Generous: eviction only risks a re-fire for a pair
// last seen a thousand pairs ago.
const IMPRESSION_DEDUP_LIMIT = 1000;

/**
 * Options shared by every {@link TrackerOptions} variant. Not used directly -
 * see {@link TrackerOptions} for the endpoint pairing rules.
 */
export type TrackerBaseOptions = {
  /** The name of the application */
  application: string;
  /**
   * The initial user id attached to events (`user_id`). Must be an opaque,
   * pseudonymous identifier - never an email address or name. Change it
   * mid-session (login/logout) with {@link Tracker.setUserId}.
   */
  userId?: string;
  /** Session inactivity timeout in milliseconds. Defaults to 30 minutes. */
  sessionInactivityTimeoutMs?: number;
  /** Maximum session duration in milliseconds. Defaults to 24 hours. */
  maxSessionDurationMs?: number;
  /**
   * When true, the default console logger also prints debug/info
   * diagnostics: every dispatched event and every delivery outcome. This is
   * the one-line install check against a server that answers 202 to
   * everything. Warnings and errors are printed regardless. Applies to the
   * default `ConsoleLogger` only - a supplied `logger` receives all levels
   * and filters for itself. Defaults to false.
   */
  debug?: boolean;
  /**
   * A logger to receive internal diagnostics. Replaces the default
   * `ConsoleLogger`, so pass one here to route (or silence) tracker logging
   * instead of writing to the console. To fan out to several destinations,
   * pass a logger that wraps them.
   */
  logger?: Logger;
};

/**
 * Configuration passed to `new Tracker()`. Delivering to Releval requires the
 * pair: `endpointHost` (the base URL browsers use to reach the Releval
 * deployment - not your site's own origin) and `siteId` (the public Site
 * identifier issued by Releval). The server silently drops events whose
 * `site_id` does not match a registered Site, so the type requires the two
 * together. Omit `endpointHost` for development mode: events go to the
 * console - or only to sinks added with `addSink`, once any are added - and
 * nothing leaves the page.
 */
export type TrackerOptions = TrackerBaseOptions &
  (
    | {
        /**
         * Base URL browsers use to reach the Releval deployment, e.g.
         * `"https://releval.example.com"` - not your site's own origin. A
         * path prefix for a reverse proxy is allowed; events POST to
         * `<endpointHost>/api/v1/ubi/track-event`.
         */
        endpointHost: string;
        /**
         * The public Site identifier issued by Releval when registering a
         * Site. Stamped on every event in the request body; identity travels
         * in the payload, not a header, because `navigator.sendBeacon`
         * cannot set custom headers on the unload path.
         */
        siteId: string;
      }
    | {
        /** Omit to log events to the console instead of delivering (development mode). */
        endpointHost?: undefined;
        /** Without an endpoint the site id is optional; it is stamped when present. */
        siteId?: string;
      }
  );

/**
 * A reference to a search result that was interacted with. Used by the
 * high-level `trackResult*` methods to build the UBI `object` + `position`
 * attributes so callers do not hand-roll the event shape.
 */
export type ResultRef = {
  /** The identifier of the object (e.g. product/SKU) that was interacted with. */
  objectId: string;
  /**
   * The absolute, 1-based rank of the result across pagination -
   * `(page - 1) * pageSize + positionOnPage` with `page` 1-based - not the
   * per-page position. It must equal index + 1 of this object in the
   * `query_response_hit_ids` your backend sent to track-query for this
   * `query_id`: either one query_id spans all pages with absolute ordinals,
   * or each page fetch is its own track-query call with its own query_id.
   */
  ordinal: number;
  /** The backend field the object id maps to (UBI `object_id_field`). Optional. */
  objectIdField?: string;
  /**
   * Any additional keys are persisted as-is under the event's
   * `event_attributes` (e.g. `badge: "sale"`). Values must be
   * JSON-serialisable. Keys the tracker itself owns - `object`, `position`,
   * `event_id`, `tracker`, `page`, `browser` - are overwritten by it; use
   * {@link Tracker.dispatch} for full control of the event shape.
   */
  [key: string]: unknown;
};

/** Options for {@link Tracker.trackResultEvent}. */
export type TrackResultEventOptions = {
  /** The UBI `action_name` (e.g. `"add_to_cart"`, `"purchase"`, `"view"`). */
  actionName: string;
  /** The identifier of the object (e.g. product/SKU) the event is about. */
  objectId: string;
  /** The backend field the object id maps to (UBI `object_id_field`). Optional. */
  objectIdField?: string;
  /**
   * The absolute, 1-based rank the result was returned at. Optional: when
   * omitted it is resolved from the attribution recorded by
   * {@link Tracker.trackResultClick} for the same `objectId`. When neither is
   * available the event carries no position.
   */
  ordinal?: number;
  /**
   * The server-issued `query_id` that produced this result. Optional: when
   * omitted it is resolved from the attribution recorded by
   * {@link Tracker.trackResultClick} for the same `objectId`, so a conversion
   * on a later page joins to the originating query without the integrator
   * threading it by hand. When neither is available the event is sent
   * unattributed and a warning is logged once.
   */
  queryId?: string;
  /** The query text as the user entered it, if known (populates `user_query`). */
  query?: string;
  /**
   * Any additional keys are persisted as-is under the event's
   * `event_attributes` (e.g. `badge: "sale"`). Values must be
   * JSON-serialisable. Keys the tracker itself owns - `object`, `position`,
   * `event_id`, `tracker`, `page`, `browser` - are overwritten by it; use
   * {@link Tracker.dispatch} for full control of the event shape.
   */
  [key: string]: unknown;
};

/** Options for {@link Tracker.trackResultClick}. */
export type TrackResultClickOptions = ResultRef & {
  /** The server-issued `query_id` that produced this result. Required. */
  queryId: string;
  /** The query text as the user entered it, if known (populates `user_query`). */
  query?: string;
  /** Override the `action_name`. Defaults to `"click"`. */
  actionName?: string;
};

/** Options for {@link Tracker.trackResultImpression}. */
export type TrackResultImpressionOptions = {
  /** The results that became visible, each with its object id and absolute rank. */
  items: ResultRef[];
  /** The server-issued `query_id` that produced these results. Required. */
  queryId: string;
  /** The query text as the user entered it, if known (populates `user_query`). */
  query?: string;
};

/** Options for {@link Tracker.trackSearch}. */
export type TrackSearchOptions = {
  /** The query text as the user entered it. */
  query: string;
  /** The server-issued `query_id` for this search. Required. */
  queryId: string;
  /**
   * Any additional keys are persisted as-is under the event's
   * `event_attributes` (e.g. `badge: "sale"`). Values must be
   * JSON-serialisable. Keys the tracker itself owns - `object`, `position`,
   * `event_id`, `tracker`, `page`, `browser` - are overwritten by it; use
   * {@link Tracker.dispatch} for full control of the event shape.
   */
  [key: string]: unknown;
};

/**
 * The entry point of `@releval/tracker`: collects User Behavior Insights
 * events - searches, result impressions, result clicks and the conversions
 * that follow - in the canonical joinable shape
 * (`query_id` + `object_id` + `ordinal`) and delivers them to a Releval
 * deployment's track-event API.
 *
 * Events flow through a small pipeline: the high-level `track*` methods (or
 * the declarative collectors) build canonical events, enrichers stamp
 * context (application, session, client id, page, browser), and sinks
 * deliver - batched with retry to the endpoint, or to the console in
 * development. Nothing is delivered before {@link Tracker.start}; earlier
 * dispatches are buffered and replayed.
 *
 * @example
 * ```ts
 * const tracker = new Tracker({
 *   application: "primary-search",
 *   siteId: "YOUR_SITE_ID",
 *   endpointHost: "https://releval.example.com",
 * });
 * tracker.start();
 *
 * tracker.trackSearch({ query, queryId }); // ids come from your backend
 * tracker.trackResultClick({ objectId, ordinal, queryId });
 * tracker.trackResultEvent({ actionName: "add_to_cart", objectId });
 * ```
 *
 * The full integration flow is documented at
 * https://releval.co/docs/user-behavior-insights/browser-tracker
 */
export class Tracker {
  private readonly enrichers: Set<Enricher>;
  private readonly options: TrackerOptions;
  private readonly _sessionManager: SessionManager;
  private started: boolean;
  // Distinguishes "not started yet" (buffer and replay) from "stopped after
  // running" (drop): see dispatch().
  private hasEverStarted = false;
  private collectors: Set<Collector>;
  private readonly detaches = new Map<Collector, Detach>();
  private sink?: AggregateSink;
  private batchSink?: BatchSink;
  private readonly logger: Logger;
  private dispatcher?: Dispatcher;
  private _clientId?: string;
  private _userId?: string;
  private _attribution?: AttributionStore;
  private hasWarnedMissingQueryId = false;
  private hasWarnedUnattributedResult = false;
  private hasWarnedInvalidOrdinal = false;
  // Events dispatched before start() are buffered (bounded) and replayed at
  // start(), because framework lifecycles routinely dispatch first: React
  // runs child effects before the parent provider's start() effect.
  private readonly preStartBuffer: UbiEvent[] = [];
  private hasWarnedPreStartOverflow = false;
  // Impressions already reported by this instance, keyed queryId+objectId, so
  // re-renders and remounted components cannot inflate the CTR denominator.
  private readonly seenImpressions = new Set<string>();
  // User-supplied sinks (via addSink). Kept separately from the auto-created
  // endpoint/console sink so that a stop()/start() cycle rebuilds the internal
  // pipeline without discarding them.
  private readonly extraSinks = new Set<Sink>();

  constructor(options: TrackerOptions) {
    this.options = options;
    this.collectors = new Set<Collector>();
    this.started = false;

    // Default to a console logger so failures (dropped events, bad site_id,
    // non-retryable responses) are visible without any extra wiring. A caller
    // can replace it via the `logger` option (e.g. to silence the console).
    // Wrapped so a throwing consumer logger can never escape the tracker's
    // own catch blocks.
    this.logger = safeLogger(
      options.logger ?? new ConsoleLogger({ verbose: options.debug }),
    );

    this._sessionManager = new SessionManager({
      storage: this.localStorage,
      inactivityTimeoutMs: options.sessionInactivityTimeoutMs,
      maxSessionDurationMs: options.maxSessionDurationMs,
      logger: this.logger,
    });

    this._userId = options.userId;

    this.enrichers = new Set<Enricher>([
      new OptionsEnricher({
        application: options.application,
        siteId: options.siteId,
        userId: () => this._userId,
      }),
      new BrowserEnricher(),
      new PageEnricher(),
      new SessionEnricher(
        () => this.sessionId,
        () => this._sessionManager.touch(),
      ),
      new ClientIdEnricher(() => this.clientId),
    ]);
  }

  private _localStorage?: Storage;

  /**
   * The tracker's local storage (with fallbacks when Web Storage is
   * unavailable). Internal: collectors and stores receive it via options.
   */
  private get localStorage(): Storage {
    if (!this._localStorage) {
      this._localStorage = initLocalStorage();
    }
    return this._localStorage;
  }

  private _sessionStorage?: Storage;

  /**
   * The tracker's session storage (with fallbacks when Web Storage is
   * unavailable). Internal: collectors and stores receive it via options.
   */
  private get sessionStorage(): Storage {
    if (!this._sessionStorage) {
      this._sessionStorage = initSessionStorage();
    }
    return this._sessionStorage;
  }

  /**
   * Gets the session identifier. Automatically rotates on inactivity or max duration.
   */
  get sessionId(): string {
    return this._sessionManager.sessionId;
  }

  /**
   * Gets the stable anonymous client/device ID. Persisted in localStorage across sessions.
   */
  get clientId(): string {
    if (!this._clientId) {
      this._clientId = getOrCreateClientId(this.localStorage, this.logger);
    }
    return this._clientId;
  }

  /**
   * Sets (or clears, with `undefined`) the user id stamped on events - for a
   * login or logout that happens without a page reload. Applies to events
   * dispatched after the call; events already queued or persisted for retry
   * keep the identity they were stamped with. An explicit `user_id` on a
   * dispatched event still wins. Callable before `start()`. Does not rotate
   * the session or touch the client id. The value must be an opaque,
   * pseudonymous identifier - never an email address or name.
   */
  public setUserId(userId: string | undefined): void {
    this._userId = userId;
  }

  /**
   * The object-keyed attribution store, created on first use so construction
   * performs no storage IO for it.
   */
  private get attribution(): AttributionStore {
    if (!this._attribution) {
      this._attribution = new AttributionStore({
        localStorage: this.localStorage,
        sessionStorage: this.sessionStorage,
        sessionId: () => this.sessionId,
        logger: () => this.logger,
      });
    }
    return this._attribution;
  }

  /**
   * Returns the attribution recorded by {@link Tracker.trackResultClick} for
   * an object in the current session, or undefined. Use it to build custom
   * conversion payloads (e.g. a checkout page resolving several line items).
   */
  public getResultAttribution(objectId: string): AttributionRecord | undefined {
    try {
      return this.attribution.get(objectId);
    } catch (e) {
      this.logger.error("Error reading result attribution: ", e);
      return undefined;
    }
  }

  /**
   * Reports that a search ran, with the server-issued `query_id`. Call this
   * after your search backend returns results.
   *
   * Dispatches a `search` event (`message_type: "QUERY"`) carrying `query_id`
   * and `user_query`. Without it a query that gets no impression and no click
   * leaves no event at all, so abandonment and reformulation cannot be
   * analysed downstream.
   */
  public trackSearch(options: TrackSearchOptions): void {
    try {
      const { query, queryId, ...extras } = options;
      if (!queryId && !this.hasWarnedMissingQueryId) {
        // Warn once, endpoint or not: development mode must surface the same
        // mistakes production would. A search event without a query_id still
        // reaches the server, but nothing can be joined back to it, so it is
        // worthless for relevance analysis. Loud, non-breaking diagnostic for
        // JS callers (the TypeScript type already requires queryId).
        this.hasWarnedMissingQueryId = true;
        this.logger.warn(
          "Tracker.trackSearch: called without a queryId. The search event is still emitted " +
            "but result clicks and impressions cannot be attributed back to this query. Pass " +
            "the query_id issued by your search backend (Releval track-query): " +
            "tracker.trackSearch({ query, queryId }).",
        );
      }

      const event: UbiEvent = {
        action_name: "search",
        message_type: "QUERY",
        user_query: query,
      };
      if (queryId) {
        event.query_id = queryId;
      }
      if (Object.keys(extras).length > 0) {
        event.event_attributes = { ...extras };
      }
      this.dispatch(event);
    } catch (e) {
      this.logger.error("Error tracking search: ", e);
    }
  }

  /**
   * Dispatches a UBI event for a search result in the canonical shape
   * (`query_id`, `event_attributes.object.object_id`, `event_attributes.position.ordinal`),
   * so callers never hand-build it. Prefer {@link Tracker.trackResultClick} /
   * {@link Tracker.trackResultImpression}; use this directly for conversions
   * (e.g. `actionName: "add_to_cart"` or `"purchase"`), where `queryId` and
   * `ordinal` may be omitted and are resolved from the attribution recorded
   * when the result was clicked - including on a later page. When `queryId`
   * IS supplied and matches the recorded click, a missing `ordinal`/`query`
   * is still borrowed from it, so the row shape does not depend on which
   * page supplied the id.
   */
  public trackResultEvent(options: TrackResultEventOptions): void {
    try {
      const {
        actionName,
        objectId,
        objectIdField,
        ordinal: suppliedOrdinal,
        queryId: suppliedQueryId,
        query: suppliedQuery,
        ...extras
      } = options;
      let ordinal = suppliedOrdinal;
      let queryId = suppliedQueryId;
      let query = suppliedQuery;

      if (
        queryId === undefined ||
        ordinal === undefined ||
        query === undefined
      ) {
        const attribution = this.attribution.get(objectId);
        if (attribution) {
          if (queryId === undefined) {
            queryId = attribution.queryId;
            ordinal = ordinal ?? attribution.ordinal;
            query = query ?? attribution.query;
          } else if (attribution.queryId === queryId) {
            // The caller supplied the query (e.g. read from the DOM) but not
            // the rank: borrow it from the recorded click for the SAME query,
            // so the row shape does not depend on which page supplied the id.
            // A mismatched query borrows nothing - never mix two searches.
            ordinal = ordinal ?? attribution.ordinal;
            query = query ?? attribution.query;
          }
        }
      }

      if (ordinal !== undefined && !isValidOrdinal(ordinal)) {
        // Never send a fabricated rank: drop the field, keep the event.
        if (!this.hasWarnedInvalidOrdinal) {
          this.hasWarnedInvalidOrdinal = true;
          this.logger.warn(
            `Tracker: ignoring invalid ordinal ${String(ordinal)} for "${objectId}" - ` +
              "an ordinal is a positive integer: (page - 1) * pageSize + positionOnPage.",
          );
        }
        ordinal = undefined;
      }

      if (!queryId && !this.hasWarnedUnattributedResult) {
        // Warn once. The event is still delivered, but without a query_id it
        // cannot be joined back to a search for relevance analysis.
        this.hasWarnedUnattributedResult = true;
        this.logger.warn(
          `Tracker.trackResultEvent: no queryId was supplied and no attribution is recorded for "${objectId}" ` +
            "in this session, so the event is sent unattributed. Either pass queryId explicitly or report " +
            "the originating click with tracker.trackResultClick so conversions resolve automatically.",
        );
      }

      const object: { object_id: string; object_id_field?: string } = {
        object_id: objectId,
      };
      if (objectIdField) {
        object.object_id_field = objectIdField;
      }

      const event: UbiEvent = {
        action_name: actionName,
        // Caller extras first, canonical keys after: object and position
        // always win a key collision.
        event_attributes: { ...extras, object },
      };
      if (typeof ordinal === "number") {
        event.event_attributes!.position = { ordinal };
      }
      if (queryId) {
        event.query_id = queryId;
      }
      if (query) {
        event.user_query = query;
      }

      this.dispatch(event);
    } catch (e) {
      this.logger.error("Error tracking result event: ", e);
    }
  }

  /**
   * Dispatches a `click` event for a clicked search result, attributed to
   * `queryId` (required at the call site by design), and records the
   * attribution for the object so later conversion events for it - on this
   * page or a later one - resolve the originating query automatically.
   */
  public trackResultClick(options: TrackResultClickOptions): void {
    try {
      const { objectId, ordinal, queryId, query } = options;
      this.trackResultEvent({
        ...options,
        actionName: options.actionName ?? "click",
      });
      this.attribution.register(objectId, { queryId, ordinal, query });
    } catch (e) {
      this.logger.error("Error tracking result click: ", e);
    }
  }

  /**
   * Dispatches an `impression` event for each result that became visible,
   * attributed to `queryId`. Emits one canonical event per item so impressions
   * join to clicks on `object_id`/`ordinal`.
   *
   * Each `(queryId, objectId)` pair is reported ONCE per Tracker instance:
   * re-renders, virtualized-list remounts and re-discovered elements do not
   * inflate the impression count (the CTR denominator), while a new `queryId`
   * re-fires for results returned by consecutive searches. A full page load
   * builds a fresh Tracker and so starts fresh; when revisits matter,
   * deduplicate downstream on distinct `(query_id, object_id)`.
   */
  public trackResultImpression(options: TrackResultImpressionOptions): void {
    try {
      for (const item of options.items) {
        const key = `${options.queryId}\u0000${item.objectId}`;
        if (this.seenImpressions.has(key)) {
          continue;
        }
        if (this.seenImpressions.size >= IMPRESSION_DEDUP_LIMIT) {
          // Bounded: evict the oldest pair (Set preserves insertion order)
          // rather than growing without limit in a long-lived SPA session.
          const oldest = this.seenImpressions.values().next().value;
          if (oldest !== undefined) {
            this.seenImpressions.delete(oldest);
          }
        }
        this.seenImpressions.add(key);

        this.trackResultEvent({
          ...item,
          actionName: "impression",
          queryId: options.queryId,
          query: options.query,
        });
      }
    } catch (e) {
      this.logger.error("Error tracking result impression: ", e);
    }
  }

  /**
   * Adds an enricher that runs on every event before emission (e.g. stamping
   * an A/B variant, store or locale - the split key for any comparison).
   * Returns a disposer that removes it again.
   */
  public addEnricher(enricher: Enricher): () => void {
    try {
      this.enrichers.add(enricher);
      return () => {
        this.enrichers.delete(enricher);
      };
    } catch (e) {
      this.logger.error("Error adding enricher: ", e);
      return () => {};
    }
  }

  /**
   * Registers a collector so it attaches at start() (or immediately when the
   * tracker is already started), and returns a function that detaches and
   * unregisters it again.
   */
  private registerCollector(collector: Collector): () => void {
    try {
      if (!this.collectors.has(collector)) {
        if (this.started) {
          try {
            this.detaches.set(collector, collector.attach(this.dispatcher!));
          } catch (e) {
            this.logger.error("Error attaching collector: ", e);
          }
        }
        this.collectors.add(collector);
      }
    } catch (e) {
      this.logger.error("Error adding collector: ", e);
    }

    return () => {
      try {
        const detach = this.detaches.get(collector);
        this.detaches.delete(collector);
        this.collectors.delete(collector);
        detach?.();
      } catch (e) {
        this.logger.error("Error detaching collector: ", e);
      }
    };
  }

  /**
   * Binds declarative result-click collection to the DOM: one delegated
   * listener reports clicks on elements matching `selector` in the canonical
   * joinable shape, reading `data-object-id` / `data-ordinal` from the result
   * element and `data-query-id` from its nearest ancestor (or a custom
   * `resolve`). A resolved `data-action-name` other than `click` (e.g.
   * `add_to_cart`) is routed through {@link Tracker.trackResultEvent}, so its
   * attribution can resolve from the recorded click.
   *
   * Use `ignore` for interactive descendants of a result (an add-to-cart
   * button inside the card) so their clicks are not double-reported as result
   * clicks.
   *
   * @returns a function that stops this collection again.
   */
  public trackResultClicks(options: TrackResultClicksOptions): () => void {
    try {
      const collector = new ResultClickCollector(options, (resolved) =>
        this.emitResolvedResultClick(resolved),
      );
      return this.registerCollector(collector);
    } catch (e) {
      this.logger.error("Error creating result click collector: ", e);
      return () => {};
    }
  }

  /** Routes a resolved declarative click through the high-level API. */
  private emitResolvedResultClick(resolved: ResolvedResultClick): void {
    // Spread, not field-by-field: custom event attributes resolved from
    // data-event-* (or returned by a custom resolver) ride along untouched.
    const { actionName: resolvedAction, ...data } = resolved;
    const actionName = resolvedAction ?? "click";
    if (
      actionName === "click" &&
      resolved.queryId &&
      typeof resolved.ordinal === "number"
    ) {
      this.trackResultClick({
        ...data,
        objectId: resolved.objectId,
        ordinal: resolved.ordinal,
        queryId: resolved.queryId,
      });
      return;
    }

    this.trackResultEvent({ ...data, actionName });
  }

  /**
   * Binds declarative result-impression collection to the DOM: each element
   * matching `selector` emits one canonical `impression` event the first time
   * it enters the viewport, attributed via the same data-attribute convention
   * as {@link Tracker.trackResultClicks} (or a custom `resolve`). Elements
   * added or re-rendered after `start()` are discovered automatically.
   *
   * @returns a function that stops this collection again.
   */
  public trackResultImpressions(
    options: TrackResultImpressionsOptions,
  ): () => void {
    try {
      const collector = new ResultImpressionCollector(
        options,
        (items, queryId, query) =>
          this.trackResultImpression({ items, queryId, query }),
      );
      return this.registerCollector(collector);
    } catch (e) {
      this.logger.error("Error creating result impression collector: ", e);
      return () => {};
    }
  }

  /**
   * Adds a sink that receives every emitted event (e.g. mirroring into your
   * own analytics, or a test spy). Returns a disposer that removes it again.
   */
  public addSink(sink: Sink): () => void {
    try {
      this.extraSinks.add(sink);
      // If already started, add to the live aggregate so the change reaches the
      // dispatcher (which holds a stable reference to it). If not started, the
      // sink is picked up when start() builds the pipeline.
      if (this.started && this.sink) {
        this.sink.add(sink);
      }
      return () => {
        this.extraSinks.delete(sink);
        this.sink?.delete(sink);
      };
    } catch (e) {
      this.logger.error("Error adding sink: ", e);
      return () => {};
    }
  }

  /**
   * starts the tracker and attaches all collectors.
   */
  public start() {
    try {
      if (this.started) {
        return;
      }

      const { endpointHost, siteId } = this.options;
      if (endpointHost && !siteId) {
        this.logger.error(
          "Tracker.start: endpointHost is set but siteId is missing. Every event will be dropped by the server. Set `siteId` to the public Site identifier issued by Releval.",
        );
      }

      // A page load is user activity: on a classic multi-page site nothing
      // may be dispatched for a while after start(), and without this a
      // 31-minute read of a product page would rotate the session and drop
      // attribution even though the user never left.
      this._sessionManager.activity();

      // Build a fresh internal pipeline every start(), so a stop()/start()
      // cycle never reuses a disposed BatchSink. The effective sink is always
      // an AggregateSink whose reference is stable for the dispatcher, so
      // addSink() after start() reaches it via .add().
      this.sink = this.buildSink();
      this.dispatcher = new DefaultDispatcher(
        this.enrichers,
        this.sink,
        this.logger,
      );

      this.collectors.forEach((collector) => {
        try {
          this.detaches.set(collector, collector.attach(this.dispatcher!));
        } catch (e) {
          this.logger.error("Error attaching collector: ", e);
        }
      });

      this.started = true;
      this.hasEverStarted = true;

      if (this.preStartBuffer.length > 0) {
        const buffered = this.preStartBuffer.splice(0);
        this.logger.debug(
          `ubi: replaying ${buffered.length} event(s) dispatched before start()`,
        );
        for (const event of buffered) {
          this.dispatcher!.dispatch(event);
        }
      }
    } catch (e) {
      this.logger.error("Error starting tracker: ", e);
    }
  }

  /**
   * Builds the effective sink from the configured endpoint plus any user sinks.
   * ConsoleSink is used only when there is neither an endpoint nor a user sink
   * (the development default). The result is always an AggregateSink so its
   * reference stays stable across addSink() calls.
   */
  private buildSink(): AggregateSink {
    const { endpointHost } = this.options;
    const sinks = new Set<Sink>();

    if (endpointHost) {
      this.batchSink = new BatchSink({
        endpointHost,
        storage: this.localStorage,
        logger: this.logger,
      });
      sinks.add(this.batchSink);
    }

    for (const sink of this.extraSinks) {
      sinks.add(sink);
    }

    if (sinks.size === 0) {
      sinks.add(new ConsoleSink());
    }

    return new AggregateSink(sinks, this.logger);
  }

  /**
   * Dispatches an event through the tracker pipeline (enrichers → sinks).
   * Use this to send custom events that aren't captured by a collector.
   * Safe to call before start(): the event is buffered (bounded), stamped
   * with the timestamp of the moment it happened, and replayed once start()
   * runs.
   * @param event The event to dispatch.
   */
  public dispatch(event: UbiEvent) {
    if (!this.started || !this.dispatcher) {
      if (this.hasEverStarted) {
        // After stop() the tracker is off: drop, do not queue for a start()
        // that may never come (a later delivery would misdate the interaction
        // anyway). Pre-START dispatches below are different: framework
        // lifecycles routinely dispatch before start().
        this.logger.debug("ubi: tracker is stopped; event dropped", event);
        return;
      }
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }
      // Stamp the identity current at DISPATCH time: a logout between this
      // dispatch and start() must not rewrite who did it.
      if (!event.user_id && this._userId) {
        event.user_id = this._userId;
      }
      if (this.preStartBuffer.length >= PRE_START_BUFFER_LIMIT) {
        if (!this.hasWarnedPreStartOverflow) {
          this.hasWarnedPreStartOverflow = true;
          this.logger.warn(
            `More than ${PRE_START_BUFFER_LIMIT} events were dispatched before start(); dropping the oldest. Call start() earlier.`,
          );
        }
        this.preStartBuffer.shift();
      }
      this.preStartBuffer.push(event);
      return;
    }
    this.dispatcher.dispatch(event);
  }

  /**
   * Forces immediate delivery of any queued events, rather than waiting for the
   * next batch interval. Useful before a critical action or a hard navigation.
   * Resolves once the current batch has been sent (or scheduled for retry).
   * A no-op that resolves immediately when there is no batching sink (events go
   * to the console) or the tracker is stopped.
   */
  public flush(): Promise<void> {
    try {
      return this.batchSink?.flush() ?? Promise.resolve();
    } catch (e) {
      this.logger.error("Error flushing events: ", e);
      return Promise.resolve();
    }
  }

  /**
   * stops the tracker and detaches all collectors.
   */
  public stop() {
    try {
      if (!this.started) {
        return;
      }

      this.detaches.forEach((detach) => {
        try {
          detach();
        } catch (e) {
          this.logger.error("Error detaching collector: ", e);
        }
      });
      this.detaches.clear();

      if (this.batchSink) {
        this.batchSink.dispose();
      }

      // Discard the internal pipeline so a subsequent start() rebuilds a fresh
      // sink and dispatcher rather than reusing the disposed BatchSink (which
      // would silently drop every event). User sinks live in extraSinks and are
      // re-combined on the next start().
      this.sink = undefined;
      this.batchSink = undefined;
      this.dispatcher = undefined;

      this.started = false;
    } catch (e) {
      this.logger.error("Error stopping tracker: ", e);
    }
  }
}
