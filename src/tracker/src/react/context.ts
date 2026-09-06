import { createContext } from "react";
import type { Tracker } from "../tracker";

/**
 * Holds the configured {@link Tracker} for a React tree. Provided by
 * {@link TrackerProvider} and read with {@link useTracker}.
 */
export const TrackerContext = createContext<Tracker | null>(null);
