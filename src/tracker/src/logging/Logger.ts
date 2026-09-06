/**
 * Logging interface for internal tracker diagnostics. Implement this to
 * integrate the tracker's log output with your application's logging system,
 * then pass it as the `logger` option. To fan out to several destinations
 * (e.g. the console AND your own service), pass a logger that wraps both.
 */
export interface Logger {
  /**
   * Logs a debug message
   * @param msg the message
   * @param data the additional data
   */
  debug(msg: string, ...data: any[]): void;

  /**
   * Logs an info message
   * @param msg the message
   * @param data the additional data
   */
  info(msg: string, ...data: any[]): void;

  /**
   * Logs a warn message
   * @param msg the message
   * @param data the additional data
   */
  warn(msg: string, ...data: any[]): void;

  /**
   * Logs an error message
   * @param msg the message
   * @param data the additional data
   */
  error(msg: string, ...data: any[]): void;
}
