import type { Logger } from "./Logger";

const report = (e: unknown): void => {
  try {
    console.error("The configured tracker logger threw: ", e);
  } catch {
    // Nothing left to report to.
  }
};

/**
 * Wraps a logger so a throwing consumer logger can never escape the tracker's
 * own catch blocks (which themselves log) or `dispatch()`. The original
 * failure is surfaced via `console.error` rather than swallowed. Internal.
 */
export const safeLogger = (logger: Logger): Logger => ({
  debug(msg: string, ...data: any[]): void {
    try {
      logger.debug(msg, ...data);
    } catch (e) {
      report(e);
    }
  },
  info(msg: string, ...data: any[]): void {
    try {
      logger.info(msg, ...data);
    } catch (e) {
      report(e);
    }
  },
  warn(msg: string, ...data: any[]): void {
    try {
      logger.warn(msg, ...data);
    } catch (e) {
      report(e);
    }
  },
  error(msg: string, ...data: any[]): void {
    try {
      logger.error(msg, ...data);
    } catch (e) {
      report(e);
    }
  },
});
