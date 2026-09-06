/**
 * React bindings for `@releval/tracker`.
 *
 * Import from the `@releval/tracker/react` subpath. React is an optional peer
 * dependency, so this module is only pulled in when you use it.
 *
 * The surface is deliberately small: a provider that owns the tracker
 * lifecycle, a hook to read it, a {@link SearchResults} context declaring
 * which search produced the results beneath it, and a
 * {@link useResultImpression} ref hook for viewport impressions. Clicks need
 * no hook - call `useTracker().trackResultClick(...)` from your own handler.
 * There is intentionally NO router / page-view hook: nothing downstream
 * consumes bare page views, so the library does not emit them.
 */

export type { Enricher } from "../enrichers";
export type { Logger } from "../logging";
export type { Sink } from "../sinks";
// Re-export the core types (and the Tracker class, for the `tracker` prop
// escape hatch) so React consumers building enrichers, sinks or custom
// events do not have to also import from the root entry.
export {
  type ResultRef,
  Tracker,
  type TrackerBaseOptions,
  type TrackerOptions,
  type TrackResultClickOptions,
  type TrackResultEventOptions,
  type TrackResultImpressionOptions,
  type TrackSearchOptions,
} from "../tracker";
export type {
  Event,
  EventAttributes,
  EventObject,
  EventPosition,
} from "../types";
export {
  SearchResults,
  type SearchResultsProps,
  type SearchResultsValue,
  useSearchResults,
} from "./SearchResults";
export {
  TrackerProvider,
  type TrackerProviderBaseProps,
  type TrackerProviderProps,
  useTracker,
} from "./TrackerProvider";
export {
  type UseResultImpressionOptions,
  useResultImpression,
} from "./useResultImpression";
