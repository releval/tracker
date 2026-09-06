// Auto-generated from UBI event schema v1.3.0
// Source: https://raw.githubusercontent.com/o19s/ubi/refs/heads/main/schema/1.3.0/event.schema.json
// Do not edit manually - run `npm run generate:types` to regenerate.
/**
 * The core UBI event structure that is enriched and emitted to sinks.
 *
 * Only `action_name` is required when dispatching - the dispatcher auto-sets
 * `timestamp` and enrichers populate contextual fields like `application`,
 * `session_id`, `client_id`, and browser/page metadata before the event
 * reaches the sink.
 *
 * @see https://o19s.github.io/ubi/schema/1.3.0/event.schema.json
 */
export interface Event {
  /**
   * Name of the application integrated with UBI. Distinguishes event sources
   * when multiple search UIs feed into the same backend.
   * @example "primary-search"
   * @example "type-ahead"
   */
  application?: string;
  /**
   * The name of the action that triggered the event.
   * Common values: `"click"`, `"add_to_cart"`, `"purchase"`, `"impression"`, `"view"`, `"watch"`.
   * Any custom string is also accepted.
   */
  action_name: string;
  /**
   * The unique identifier of the query that this event is associated with,
   * typically a UUID. Links events back to the originating search.
   * @example "00112233-4455-6677-8899-aabbccddeeff"
   * @example "1234-user-5678"
   */
  query_id?: string;
  /**
   * The session identifier, used to correlate interactions across page navigations
   * and to track unique visits for both authenticated and anonymous users.
   * Populated automatically by the SessionEnricher.
   * @example "84266fdbd31d4c2c6d0665f7e8380fa3"
   */
  session_id?: string;
  /**
   * A stable anonymous identifier for the client issuing events.
   * This could be a unique browser, a microservice, or a crawling bot.
   * Populated automatically by the ClientIdEnricher.
   * @example "5e3b2a1c-8b7d-4f2e-a3d4-c9b2e1f3a4b5"
   * @example "quepid-nightly-bot"
   */
  client_id?: string;
  /**
   * The authenticated user identifier, if available.
   * May be `undefined` for anonymous/unauthenticated users.
   * @example "5e3b2a1c-8b7d-4f2e-a3d4-c9b2e1f3a4b5"
   */
  user_id?: string;
  /**
   * When the event took place, formatted as an ISO 8601 date-time string.
   * Auto-set by the dispatcher if not provided.
   * @example "2018-11-13T20:20:39+00:00"
   * @example "2018-11-13T20:20:39Z"
   */
  timestamp?: string;
  /**
   * Groups related `action_name` values into logical categories.
   * @example "QUERY"
   * @example "CONVERSION"
   */
  message_type?: string;
  /**
   * Optional text message for the log entry. For a `message_type` of `"QUERY"`,
   * this would typically contain the search text.
   */
  message?: string;
  /** The query as the user entered it, before any normalization or processing. */
  user_query?: string;
  /**
   * Contextual data attached to a tracked event describing what was interacted with
   * and where it appeared on the page. Additional custom properties can be added via
   * the index signature.
   */
  event_attributes?: EventAttributes;
  /**
   * The public Site identifier issued by Releval when registering a Site.
   * Stamped automatically by the OptionsEnricher from `TrackerOptions.siteId`.
   * A Releval extension to the UBI schema: the server drops events whose
   * `site_id` does not match a registered Site.
   * @example "01J8ZP4Q9K7X2M5N6R8T0V3W1Y"
   */
  site_id?: string;
}

/**
 * Contextual data attached to a tracked event describing what was interacted with
 * and where it appeared on the page. Additional custom properties can be added via
 * the index signature.
 */
export interface EventAttributes {
  /**
   * Identifies the object (e.g. product, document) that was interacted with.
   * Additional custom properties can be added via the index signature.
   */
  object?: EventObject;
  /**
   * Describes where an interaction occurred relative to other items on the page.
   * Use `ordinal` for list/grid rank and `x`/`y` for coordinate-based positioning.
   * Additional custom properties can be added via the index signature.
   */
  position?: EventPosition;
  /**
   * A stable per-event identifier, set once by the dispatcher when the event
   * is created. A Releval extension to the UBI schema. It lives under
   * `event_attributes` because that is where the server preserves unknown
   * fields, so delivery retries (which can duplicate) stay deduplicable in
   * analysis: `LIMIT 1 BY event_attributes.event_id`.
   * @example "01J8ZP4Q9K7X2M5N6R8T0V3W1Y"
   */
  event_id?: string;
  /**
   * The tracker build that produced the event (`{ version }`), stamped by the
   * dispatcher. A Releval extension, for supportability once several tracker
   * versions are deployed across customer sites.
   */
  tracker?: any;

  [key: string]: any;
}

/**
 * Identifies the object (e.g. product, document) that was interacted with.
 * Additional custom properties can be added via the index signature.
 */
export interface EventObject {
  /**
   * The identifier that uniquely locates the object within the document corpus.
   * Variants should be incorporated, so for a red t-shirt use the SKU-level identifier.
   * Always a string on the wire: the Releval server binds it strictly and rejects
   * the whole batch when a number arrives.
   * @example "XYZ-12345"
   * @example "ISBN 0-061-96436-0"
   */
  object_id: string;
  /**
   * The type/namespace of the object identifier.
   * Common values: `"product"`, `"user"`, `"post"`, `"comment"`, `"video"`.
   */
  object_id_type?: string;
  /**
   * The name of the field that stores the object identifier in the backend data store.
   * If omitted, the search index's default primary identifier is used (e.g. `_id` in OpenSearch).
   */
  object_id_field?: string;
  /**
   * The internal identifier that the search engine uses to index the object.
   * For example, the `_id` field in OpenSearch indices - pass numeric ids as
   * strings. Always a string on the wire: the Releval server binds it strictly
   * and a number would reject the whole batch, the same hole `object_id` closes.
   * @example "1"
   * @example "123456"
   */
  internal_id?: string;

  [key: string]: any;
}

/**
 * Describes where an interaction occurred relative to other items on the page.
 * Use `ordinal` for list/grid rank and `x`/`y` for coordinate-based positioning.
 * Additional custom properties can be added via the index signature.
 */
export interface EventPosition {
  /**
   * The absolute, 1-based rank of the item across pagination:
   * `(page - 1) * pageSize + positionOnPage` with `page` 1-based. It must equal
   * index + 1 of the object in the `query_response_hit_ids` the backend sent to
   * track-query for this `query_id`. For grid layouts this is left to right,
   * ignoring wrapping.
   * @example 1
   * @example 21
   */
  ordinal?: number;
  /**
   * The x coordinate on the screen where the event was triggered.
   * Matches the Releval server's flat `x` field.
   */
  x?: number;
  /**
   * The y coordinate on the screen where the event was triggered.
   * Matches the Releval server's flat `y` field.
   */
  y?: number;

  [key: string]: any;
}
