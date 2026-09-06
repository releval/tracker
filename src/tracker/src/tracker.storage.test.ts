/**
 * Tracker storage integration against REAL jsdom Web Storage (no module
 * mock), so what is verified here is the end-to-end wiring: option
 * forwarding, session-liveness semantics, and the storage-key contract.
 */
import { Tracker } from "./tracker";

const MINUTE = 60_000;

describe("Tracker storage integration (real jsdom storage)", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
    // Console-mode trackers log every event; keep the test output quiet.
    logSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    logSpy.mockRestore();
  });

  it("start() counts as activity, so a fresh page load keeps the session alive", () => {
    const first = new Tracker({ application: "t" });
    first.start();
    const original = first.sessionId;
    first.stop();

    // 29 minutes later the user lands on the next page: a new Tracker is
    // constructed and started, with no event dispatched.
    jest.setSystemTime(Date.now() + 29 * MINUTE);
    const second = new Tracker({ application: "t" });
    second.start();

    // 29 further minutes of reading: still the same session, because the
    // page load itself was activity.
    jest.setSystemTime(Date.now() + 29 * MINUTE);
    expect(second.sessionId).toBe(original);

    // But a genuine 31-minute gap with no activity rotates.
    jest.setSystemTime(Date.now() + 31 * MINUTE);
    expect(second.sessionId).not.toBe(original);
    second.stop();
  });

  it("honours a custom sessionInactivityTimeoutMs end to end", () => {
    const tracker = new Tracker({
      application: "t",
      sessionInactivityTimeoutMs: 1000,
    });
    tracker.start();
    const first = tracker.sessionId;

    jest.setSystemTime(Date.now() + 1500);
    expect(tracker.sessionId).not.toBe(first);
    tracker.stop();
  });

  it("honours a custom maxSessionDurationMs end to end", () => {
    const tracker = new Tracker({
      application: "t",
      maxSessionDurationMs: 5000,
    });
    tracker.start();
    const first = tracker.sessionId;

    // Keep touching within the inactivity window, but exceed the max age.
    for (let i = 0; i < 3; i++) {
      jest.setSystemTime(Date.now() + 2000);
      void tracker.sessionId;
      tracker.dispatch({ action_name: "click" });
    }
    expect(tracker.sessionId).not.toBe(first);
    tracker.stop();
  });

  it("keeps the client id stable across tracker instances", () => {
    const a = new Tracker({ application: "t" });
    const b = new Tracker({ application: "t" });
    expect(a.clientId).toBe(b.clientId);
    expect(a.clientId.length).toBeGreaterThan(0);
  });

  it("writes only _ubi_-prefixed keys", () => {
    const tracker = new Tracker({ application: "t" });
    tracker.start();
    tracker.trackSearch({ query: "q", queryId: "qid" });
    tracker.trackResultClick({ objectId: "o1", ordinal: 1, queryId: "qid" });
    tracker.stop();

    expect(localStorage.length).toBeGreaterThan(0);
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        expect(store.key(i)).toMatch(/^_ubi_/);
      }
    }
  });
});
