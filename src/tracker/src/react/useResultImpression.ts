import { useCallback, useRef } from "react";
import type { ResultRef } from "../tracker";
import { useSearchResults } from "./SearchResults";
import { useTracker } from "./TrackerProvider";

/** Options for {@link useResultImpression}. */
export type UseResultImpressionOptions = {
  /** When true, no impression is observed or reported. */
  disabled?: boolean;
};

/**
 * Returns a callback ref that reports ONE canonical impression for the result
 * the first time its element becomes visible, attributed to the surrounding
 * {@link SearchResults} context.
 *
 * Fires once per query, not once per component instance: a new `queryId`
 * re-arms the hook, so a card that stays mounted across consecutive searches
 * is counted for each query. (A per-instance one-shot undercounts exactly the
 * products that are returned most often, inflating their CTR.) The Tracker
 * additionally dedupes impressions per `(queryId, objectId)` for its
 * lifetime, so remounted instances - virtualized lists, route re-entry -
 * cannot re-fire a pair this page already reported.
 *
 * Extra keys on `result` are persisted under the event's `event_attributes`
 * (see {@link ResultRef}). Changing only extras does not re-arm the
 * observer; the values current when the impression fires are sent.
 *
 * No-ops when there is no search context (nothing joinable to report), when
 * `disabled`, or where `IntersectionObserver` is unavailable.
 *
 * StrictMode-safe by construction: cleanup is driven by the callback ref
 * itself - React calls it with `null` on detach and re-invokes it when its
 * identity changes - not by an effect whose simulated unmount would
 * disconnect the observer without re-arming it.
 *
 * ```tsx
 * const ref = useResultImpression({ objectId: r.sku, ordinal });
 * return <article ref={ref}>...</article>;
 * ```
 */
export function useResultImpression(
  result: ResultRef,
  options?: UseResultImpressionOptions,
): (node: Element | null) => void {
  const tracker = useTracker();
  const search = useSearchResults();
  const firedForQuery = useRef<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Latest-value ref: extra keys on `result` ride into the fired impression
  // without being callback deps (an inline extras literal would otherwise
  // re-arm the observer every render). Identity-forming fields stay as deps.
  const latestResult = useRef(result);
  latestResult.current = result;

  const disabled = options?.disabled ?? false;
  const { objectId, ordinal } = result;
  const queryId = search?.queryId;
  const query = search?.query;

  return useCallback(
    (node: Element | null) => {
      // Called with the node on attach and null on detach; also re-invoked
      // when the callback identity changes (e.g. a new queryId arrives).
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || disabled || !queryId) return;
      if (firedForQuery.current === queryId) return;
      if (typeof IntersectionObserver === "undefined") return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (firedForQuery.current === queryId) continue;
            firedForQuery.current = queryId;

            const item: ResultRef = {
              ...latestResult.current,
              objectId,
              ordinal,
            };
            tracker.trackResultImpression({ items: [item], queryId, query });

            observer.disconnect();
            observerRef.current = null;
          }
        },
        { threshold: 0 },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [tracker, objectId, ordinal, queryId, query, disabled],
  );
}
