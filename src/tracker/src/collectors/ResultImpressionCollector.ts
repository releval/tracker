import type { Dispatcher } from "../dispatcher";
import type { ResultRef } from "../tracker";
import { createMutationObserver, debounce, isValidOrdinal } from "../utils";
import type { Collector, Detach } from "./Collector";
import { type ResolvedResultData, readResultData } from "./resolveResult";

/**
 * The result data resolved for an element that became visible: the shared
 * {@link ResolvedResultData} shape. `actionName` is ignored here - an
 * impression is always an `impression`.
 */
export type ResolvedResultImpression = ResolvedResultData;

/**
 * Resolves the result data for a visible element. Return `undefined` to skip
 * it. The default implementation reads the data-attribute convention described
 * on {@link readResultData}.
 */
export type ResultImpressionResolve = (
  element: HTMLElement,
) => ResolvedResultImpression | undefined;

/** Options for `Tracker.trackResultImpressions`. */
export type TrackResultImpressionsOptions = {
  /** CSS selector of result elements to observe for viewport visibility. */
  selector: string;
  /** The root observed for matching elements. Defaults to `document`. */
  root?: Document | Element;
  /** Custom resolver; defaults to the data-attribute convention. */
  resolve?: ResultImpressionResolve;
};

/** Receives resolved impressions, grouped per query. Internal wiring. */
export type EmitResultImpressions = (
  items: ResultRef[],
  queryId: string,
  query?: string,
) => void;

const FLUSH_DEBOUNCE_MS = 250;

/**
 * Declarative result-impression collection for server-rendered markup.
 *
 * An `IntersectionObserver` (threshold 0) reports the first time each matching
 * element enters the viewport - once per element, so a card scrolled out and
 * back does not re-fire - and a `MutationObserver` on the root discovers
 * elements added or re-rendered after `start()`, so a results grid re-rendered
 * for a new query is picked up automatically. Resolved impressions are
 * coalesced in memory for a beat and emitted per query in the canonical
 * joinable shape via the tracker's high-level API. Nothing is persisted:
 * impressions pending at detach are dropped deliberately, because after the
 * page moves on their query context can no longer be trusted.
 */
export class ResultImpressionCollector implements Collector {
  private readonly options: TrackResultImpressionsOptions;
  private readonly emit: EmitResultImpressions;
  private hasWarnedUnresolvable = false;
  private hasWarnedBodyScope = false;

  constructor(
    options: TrackResultImpressionsOptions,
    emit: EmitResultImpressions,
  ) {
    this.options = options;
    this.emit = emit;
  }

  attach(dispatcher: Dispatcher): Detach {
    const { selector } = this.options;
    const root = this.options.root ?? document;
    const resolve =
      this.options.resolve ??
      ((el: HTMLElement) => readResultData(el, dispatcher.logger));

    const pending: {
      item: ResultRef;
      queryId: string;
      query?: string;
    }[] = [];

    const flush = debounce(() => {
      const groups = new Map<
        string,
        { queryId: string; query?: string; items: ResultRef[] }
      >();
      for (const entry of pending) {
        // JSON key: plain concatenation would let distinct
        // (queryId, query) pairs collide.
        const key = JSON.stringify([entry.queryId, entry.query ?? null]);
        let group = groups.get(key);
        if (!group) {
          group = { queryId: entry.queryId, query: entry.query, items: [] };
          groups.set(key, group);
        }
        group.items.push(entry.item);
      }
      pending.length = 0;
      for (const group of groups.values()) {
        try {
          this.emit(group.items, group.queryId, group.query);
        } catch (e) {
          dispatcher.logger?.error("Error emitting impressions: ", e);
        }
      }
    }, FLUSH_DEBOUNCE_MS);

    const observedElements = new Set<HTMLElement>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const element = entry.target as HTMLElement;
          // One impression per element: unobserve on first visibility.
          observer.unobserve(element);
          observedElements.delete(element);

          try {
            const resolved = resolve(element);
            if (!resolved) continue;

            if (
              !resolved.objectId ||
              !isValidOrdinal(resolved.ordinal) ||
              !resolved.queryId
            ) {
              if (!this.hasWarnedUnresolvable) {
                this.hasWarnedUnresolvable = true;
                dispatcher.logger?.warn(
                  `trackResultImpressions: skipped an impression matching "${selector}" because objectId, ` +
                    "ordinal or queryId could not be resolved. Add data-object-id and data-ordinal to the " +
                    "result element and data-query-id to an ancestor, or supply a resolve callback. " +
                    "Further unresolvable impressions are skipped silently.",
                );
              }
              continue;
            }

            const {
              actionName: _actionName,
              queryId: _queryId,
              query: _query,
              ...itemData
            } = resolved;
            const item: ResultRef = {
              // Spread first so data-event-* extras ride along; canonical
              // keys after.
              ...itemData,
              objectId: resolved.objectId,
              ordinal: resolved.ordinal,
            };
            if (resolved.objectIdField) {
              item.objectIdField = resolved.objectIdField;
            }
            pending.push({
              item,
              queryId: resolved.queryId,
              query: resolved.query,
            });
            flush();
          } catch (e) {
            dispatcher.logger?.error("Error resolving impression: ", e);
          }
        }
      },
      { threshold: 0 },
    );

    const addHandler = (element: HTMLElement) => {
      if (
        !this.options.resolve &&
        (element === document.body || element === document.documentElement)
      ) {
        // Observing <body> would fire an "impression" for the whole page on
        // load - almost certainly a selector mistake. Warn once and skip.
        if (!this.hasWarnedBodyScope) {
          this.hasWarnedBodyScope = true;
          dispatcher.logger?.warn(
            `trackResultImpressions: the selector "${selector}" matched the page body itself; ` +
              "it is not observed. Narrow the selector to your result elements.",
          );
        }
        return;
      }
      if (!observedElements.has(element)) {
        observedElements.add(element);
        observer.observe(element);
      }
    };

    const removeHandler = (element: HTMLElement) => {
      if (observedElements.has(element)) {
        observer.unobserve(element);
        observedElements.delete(element);
      }
    };

    root.querySelectorAll<HTMLElement>(selector).forEach(addHandler);
    const mutationObserver = createMutationObserver<HTMLElement>(
      selector,
      addHandler,
      removeHandler,
    );
    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      // Anything still pending is dropped, not persisted: see class docs.
      flush.clear();
      observer.disconnect();
      observedElements.clear();
    };
  }
}
