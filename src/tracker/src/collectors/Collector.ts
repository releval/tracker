import type { Dispatcher } from "../dispatcher";

/**
 * A function to attach a collector.
 *
 * This typically involves adding event listeners and mutation observers to the DOM to collect data when events occur.
 * @param dispatcher the tracker pipeline seam; the built-in collectors use
 *   only its logger - resolved events flow through their emit callbacks
 *   into the tracker's high-level API
 * @returns A function to detach the collector.
 */
export type Attach = (dispatcher: Dispatcher) => Detach;

/**
 * A function to detach a collector. This must clean up any resources attached, which may include
 * removing any event listeners added, and disconnecting any observing mutation observers.
 */
export type Detach = () => void;

/**
 * Internal seam between the Tracker and its declarative collectors
 * (`trackResultClicks`, `trackResultImpressions`): registered collectors are
 * attached at `start()` and detached at `stop()` or via the disposer those
 * methods return. Not a public extension point - custom interactions belong
 * on your own listener calling `tracker.trackResultEvent` or
 * `tracker.dispatch`.
 */
export interface Collector {
  /**
   * A function to attach a collector.
   */
  attach: Attach;
}
