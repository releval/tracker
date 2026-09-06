import type { Logger } from "../logging";
import { isValidOrdinal } from "../utils";

/**
 * The result data resolved from a DOM element by the default data-attribute
 * convention shared by the declarative collectors.
 */
export type ResolvedResultData = {
  /** The identifier of the result object (e.g. product/SKU) - `data-object-id`. */
  objectId: string;
  /**
   * The absolute, 1-based rank of the result across pagination -
   * `data-ordinal`. `undefined` when missing, empty or not a positive
   * integer; the collectors validate before anything is emitted.
   */
  ordinal?: number;
  /** The backend field the object id maps to - `data-object-id-field`. */
  objectIdField?: string;
  /**
   * Overrides the emitted `action_name` (e.g. `"add_to_cart"`) -
   * `data-action-name`. Clicks default to `"click"`.
   */
  actionName?: string;
  /**
   * The server-issued `query_id` that produced the result - `data-query-id`
   * on the nearest ancestor carrying it (the element itself counts).
   */
  queryId?: string;
  /** The query text as the user entered it - `data-query` on that ancestor. */
  query?: string;
  /**
   * Any additional keys - `data-event-*` attributes read by the default
   * resolver, or extra keys returned by a custom one - are persisted as-is
   * under the event's `event_attributes`.
   */
  [key: string]: unknown;
};

// One-time flag for the malformed-JSON warning below; module-level because
// readResultData is a free function shared by both collectors.
let hasWarnedMalformedJson = false;

/**
 * A `data-event-*` value that looks like a JSON object or array is parsed as
 * one, so markup can carry structured attributes
 * (`data-event-filters='{"brand":"acme"}'`). Anything else - scalars
 * included - stays a string; typed scalars use the direct API. A malformed
 * candidate falls back to the raw string with a one-time warning.
 */
const parseAttributeValue = (
  raw: string,
  datasetKey: string,
  logger?: Logger,
): unknown => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return raw;
  }
  try {
    return JSON.parse(trimmed);
  } catch (_exception) {
    if (!hasWarnedMalformedJson) {
      hasWarnedMalformedJson = true;
      const attribute = `data-${datasetKey.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      logger?.warn(
        `readResultData: the value of ${attribute} looks like JSON but does not parse; ` +
          "it is kept as a string. Further malformed values are kept silently.",
      );
    }
    return raw;
  }
};

/**
 * Reads the documented data-attribute convention off a result element:
 *
 * - `data-object-id`, `data-ordinal`, `data-object-id-field` and (optionally)
 *   `data-action-name` on the result element itself;
 * - `data-event-*` on the result element for custom event attributes:
 *   `data-event-badge="sale"` becomes `badge: "sale"` (hyphens camelCase,
 *   underscores survive - `data-event-sale_price` -> `sale_price`); a value
 *   that looks like a JSON object or array is parsed as one
 *   (`data-event-filters='{"brand":"acme"}'`), any other value - scalars
 *   included - stays a string;
 * - `data-query-id` and `data-query` on the nearest ancestor carrying
 *   `data-query-id` (typically the results container, rendered server-side).
 *
 * A missing, empty or non-positive-integer `data-ordinal` yields
 * `undefined`, never 0 - a
 * fabricated rank is indistinguishable from data downstream. The collectors
 * validate what they need and warn (once) when a required field is absent.
 *
 * @param logger receives the one-time malformed-JSON warning; the collectors
 *   pass the tracker's logger.
 */
export const readResultData = (
  element: HTMLElement,
  logger?: Logger,
): ResolvedResultData => {
  const container = element.closest<HTMLElement>("[data-query-id]");
  // Number("") is 0: an empty data-ordinal must yield undefined, never a
  // fabricated rank of 0.
  const trimmed = element.dataset.ordinal?.trim();
  const parsed = trimmed ? Number(trimmed) : Number.NaN;

  // data-event-* attributes become custom event attributes: the dataset key
  // minus the prefix, first character lowercased. Only the prefixed family
  // is read, so unrelated data-* (test ids, framework state) never leaks
  // into analytics.
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(element.dataset)) {
    if (/^event[A-Z]/.test(key)) {
      extras[key.charAt(5).toLowerCase() + key.slice(6)] = parseAttributeValue(
        element.dataset[key] as string,
        key,
        logger,
      );
    }
  }

  return {
    ...extras,
    // Cast: the collectors validate presence before anything is emitted.
    objectId: element.dataset.objectId as string,
    ordinal: isValidOrdinal(parsed) ? parsed : undefined,
    objectIdField: element.dataset.objectIdField,
    actionName: element.dataset.actionName,
    queryId: container?.dataset.queryId,
    query: container?.dataset.query,
  };
};
