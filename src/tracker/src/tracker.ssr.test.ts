/**
 * @jest-environment node
 *
 * Server-side rendering safety: with no `window`/`document`/`localStorage`
 * (Node), constructing and starting a Tracker must not throw. The storage layer
 * falls back to an in-memory shim so a module-level tracker singleton (the common
 * Next.js/Remix pattern) does not crash the server render.
 */
import { Tracker } from "./tracker";

describe("Tracker under SSR (no DOM globals)", () => {
  it("does not throw on construct / start / stop without endpointHost", () => {
    expect(() => {
      const tracker = new Tracker({ application: "ssr-test" });
      tracker.start();
      tracker.stop();
    }).not.toThrow();
  });

  it("does not throw with endpointHost + siteId (BatchSink is guarded)", () => {
    expect(() => {
      const tracker = new Tracker({
        application: "ssr-test",
        siteId: "s",
        endpointHost: "https://example.com",
      });
      tracker.start();
      tracker.stop();
    }).not.toThrow();
  });

  it("exposes clientId and sessionId via the in-memory fallback", () => {
    const tracker = new Tracker({ application: "ssr-test" });
    expect(typeof tracker.clientId).toBe("string");
    expect(tracker.clientId.length).toBeGreaterThan(0);
    expect(typeof tracker.sessionId).toBe("string");
    expect(tracker.sessionId.length).toBeGreaterThan(0);
  });
});
