import type { Dispatcher } from "../dispatcher";
import { isValidOrdinal } from "../utils";
import type { Collector, Detach } from "./Collector";
import { type ResolvedResultData, readResultData } from "./resolveResult";

/**
 * The result data resolved for a clicked element. `actionName` defaults to
 * `"click"`; a click resolved to any other action (e.g. `"add_to_cart"`) is
 * routed through `trackResultEvent`, where a missing `queryId`/`ordinal` is
 * resolved from the attribution recorded when the result was clicked.
 */
export type ResolvedResultClick = ResolvedResultData;

/**
 * Resolves the result data for a clicked element. Return `undefined` to skip
 * the click entirely. The default implementation reads the data-attribute
 * convention described on {@link readResultData}.
 */
export type ResultClickResolve = (
  element: HTMLElement,
  event: MouseEvent,
) => ResolvedResultClick | undefined;

/** Options for `Tracker.trackResultClicks`. */
export type TrackResultClicksOptions = {
  /**
   * CSS selector of result elements. Clicks are matched via `closest()`, so a
   * click on any descendant of a matching element counts.
   */
  selector: string;
  /** The root the single delegated listener attaches to. Defaults to `document`. */
  root?: Document | Element;
  /**
   * Selector for elements whose clicks must NOT be reported as result clicks,
   * checked inside the matched result (e.g. `'[data-add-to-cart]'` for a
   * button nested in the card). Without it a click on the nested button would
   * emit both its own event and a result click, inflating CTR.
   */
  ignore?: string;
  /** Custom resolver; defaults to the data-attribute convention. */
  resolve?: ResultClickResolve;
};

/**
 * Declarative result-click collection for server-rendered markup.
 *
 * A single delegated, capture-phase listener on the root resolves the clicked
 * result and emits it in the canonical joinable shape via the tracker's
 * high-level API - the integrator never hand-builds a UBI event. Delegation
 * means results added or re-rendered after `start()` are covered with no
 * rebinding and no leaked listeners; capture phase means a descendant calling
 * `stopPropagation()` during bubbling cannot lose the click.
 */
export class ResultClickCollector implements Collector {
  private readonly options: TrackResultClicksOptions;
  private readonly emit: (resolved: ResolvedResultClick) => void;
  private hasWarnedUnresolvable = false;
  private hasWarnedBodyScope = false;

  constructor(
    options: TrackResultClicksOptions,
    emit: (resolved: ResolvedResultClick) => void,
  ) {
    this.options = options;
    this.emit = emit;
  }

  attach(dispatcher: Dispatcher): Detach {
    const { selector, ignore } = this.options;
    const root = this.options.root ?? document;
    const resolve =
      this.options.resolve ??
      ((el: HTMLElement) => readResultData(el, dispatcher.logger));

    const handler = (event: Event) => {
      try {
        // composedPath()[0] sees through shadow-DOM retargeting (a click
        // inside an open shadow root would otherwise resolve to the host
        // element); fall back to target where it is unavailable.
        const path = event.composedPath?.()[0];
        const target =
          path instanceof Element ? path : (event.target as Element | null);
        const matched = target?.closest<HTMLElement>(selector);
        if (!matched) return;

        if (
          !this.options.resolve &&
          (matched === document.body || matched === document.documentElement)
        ) {
          // A selector matching <body>/<html> would report every click on
          // the page as a result click under the data-attribute convention -
          // almost certainly a selector mistake. Warn once and skip.
          if (!this.hasWarnedBodyScope) {
            this.hasWarnedBodyScope = true;
            dispatcher.logger?.warn(
              `trackResultClicks: the selector "${selector}" matched the page body itself; these ` +
                "clicks are skipped. Narrow the selector to your result elements.",
            );
          }
          return;
        }

        if (ignore) {
          const ignored = target?.closest<HTMLElement>(ignore);
          // Only a PROPER descendant suppresses: an ignore selector that
          // accidentally matches the result element itself must not silence
          // every result click.
          if (ignored && ignored !== matched && matched.contains(ignored)) {
            return;
          }
        }

        const resolved = resolve(matched, event as MouseEvent);
        if (!resolved) return;

        const actionName = resolved.actionName ?? "click";
        const unresolvableClick =
          actionName === "click" &&
          (!isValidOrdinal(resolved.ordinal) || !resolved.queryId);
        if (!resolved.objectId || unresolvableClick) {
          // Skip rather than emit an unjoinable row, and say so once: the
          // server accepts anything with a 202, so a silent skip here is the
          // only place the mistake can surface.
          if (!this.hasWarnedUnresolvable) {
            this.hasWarnedUnresolvable = true;
            dispatcher.logger?.warn(
              `trackResultClicks: skipped a click matching "${selector}" because objectId, ordinal or ` +
                "queryId could not be resolved. Add data-object-id and data-ordinal to the result " +
                "element and data-query-id to an ancestor, or supply a resolve callback. " +
                "Further unresolvable clicks are skipped silently.",
            );
          }
          return;
        }

        this.emit({ ...resolved, actionName });
      } catch (e) {
        dispatcher.logger?.error("Error during handler execution: ", e);
      }
    };

    // Capture phase so a matched element is still resolved even if a
    // descendant calls stopPropagation() during bubbling.
    root.addEventListener("click", handler, { capture: true });

    return () => {
      root.removeEventListener("click", handler, { capture: true });
    };
  }
}
