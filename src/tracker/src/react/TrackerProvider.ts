import {
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Tracker, type TrackerOptions } from "../tracker";
import { TrackerContext } from "./context";

/**
 * Props shared by both {@link TrackerProviderProps} variants (provide
 * `options` OR a pre-built `tracker`).
 */
export interface TrackerProviderBaseProps {
  /**
   * Runs exactly once, before the first `start()`. Do one-time wiring here:
   * `addEnricher()`, `addSink()`. It is guarded so React StrictMode's
   * double-mount cannot run the wiring twice.
   */
  onInit?: (tracker: Tracker) => void;
  /**
   * Call `start()` on mount and `stop()` on unmount. Defaults to `true`. Set
   * `false` when an external owner controls the tracker lifecycle and the
   * provider is only used to expose the instance via context.
   */
  autoStart?: boolean;
  /** The tree that can read the tracker via {@link useTracker}. */
  children?: ReactNode;
}

/**
 * Provide the tracker either by handing over an already-constructed instance
 * (`tracker`) or by passing `options` for the provider to construct. Exactly
 * one of the two is required.
 */
export type TrackerProviderProps =
  | (TrackerProviderBaseProps & {
      /** Options the provider constructs its own {@link Tracker} from. */
      options: TrackerOptions;
      /** Not allowed together with `options`. */
      tracker?: never;
    })
  | (TrackerProviderBaseProps & {
      /** A pre-built instance owned outside React, exposed via context. */
      tracker: Tracker;
      /** Not allowed together with `tracker`. */
      options?: never;
    });

/**
 * Owns a {@link Tracker}'s lifecycle and exposes it to the tree via context.
 * Starts the tracker on mount and stops it on unmount, so components never
 * import a module singleton and the tracker is torn down cleanly.
 *
 * `options` (and `tracker`) are read ONCE on mount; later prop changes are
 * ignored. Update identity with `useTracker().setUserId(...)` rather than by
 * changing `options.userId`.
 *
 * @example
 * ```tsx
 * <TrackerProvider
 *   options={{ application: "my-app", siteId: "...", endpointHost: "..." }}
 *   onInit={(t) => t.addEnricher(abTestEnricher)}
 * >
 *   <App />
 * </TrackerProvider>
 * ```
 */
export function TrackerProvider(props: TrackerProviderProps): ReactElement {
  const { children, onInit, autoStart = true } = props;

  // Own the instance once. The lazy initializer keeps its identity stable across
  // renders, so the context value never changes and consumers do not re-render.
  const [tracker] = useState<Tracker>(() =>
    "tracker" in props && props.tracker
      ? props.tracker
      : new Tracker((props as { options: TrackerOptions }).options),
  );

  // Capture the mount-time onInit; it runs once, so later identity changes are
  // irrelevant and it never needs to be an effect dependency.
  const onInitRef = useRef(onInit);
  const initialized = useRef(false);

  useEffect(() => {
    if (!autoStart) return;
    // StrictMode runs mount -> cleanup -> mount. onInit is ref-guarded to run
    // once (one-time wiring such as addSink/addEnricher would otherwise run
    // twice), while start()/stop() are restart-safe and idempotent - so the
    // tracker ends started with the wiring applied exactly once.
    if (!initialized.current) {
      initialized.current = true;
      onInitRef.current?.(tracker);
    }
    tracker.start();
    return () => {
      tracker.stop();
    };
  }, [tracker, autoStart]);

  return createElement(TrackerContext.Provider, { value: tracker }, children);
}

/**
 * Returns the {@link Tracker} provided by the nearest {@link TrackerProvider}.
 * Throws when called outside a provider.
 */
export function useTracker(): Tracker {
  const tracker = useContext(TrackerContext);
  if (!tracker) {
    throw new Error(
      "useTracker must be used within a <TrackerProvider>. Wrap your app in " +
        "<TrackerProvider options={{ application: '...' }}> ... </TrackerProvider>.",
    );
  }
  return tracker;
}
