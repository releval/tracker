import type { Logger } from "./Logger";

/** Options for {@link ConsoleLogger}. */
export type ConsoleLoggerOptions = {
  /**
   * When true, `debug()` and `info()` are emitted as well. `warn()` and
   * `error()` are always emitted regardless. Defaults to false, so production
   * pages stay quiet except for warnings and errors that indicate lost data.
   */
  readonly verbose?: boolean;
};

/**
 * The default {@link Logger}. Routes tracker diagnostics to the browser console
 * so that an integrator can see, without any extra wiring, why events are not
 * arriving (bad site_id, non-retryable server response, storage failures, ...).
 * `debug`/`info` are suppressed unless `verbose` is set.
 */
export class ConsoleLogger implements Logger {
  private readonly verbose: boolean;

  constructor(options: ConsoleLoggerOptions = {}) {
    this.verbose = options.verbose ?? false;
  }

  debug(msg: string, ...data: any[]): void {
    if (this.verbose) {
      console.debug(msg, ...data);
    }
  }

  info(msg: string, ...data: any[]): void {
    if (this.verbose) {
      console.info(msg, ...data);
    }
  }

  warn(msg: string, ...data: any[]): void {
    console.warn(msg, ...data);
  }

  error(msg: string, ...data: any[]): void {
    console.error(msg, ...data);
  }
}
