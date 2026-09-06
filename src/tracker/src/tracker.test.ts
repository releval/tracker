import { ResultClickCollector } from "./collectors/ResultClickCollector";
import { Tracker } from "./tracker";

// Mock the storage module to avoid cookie/localStorage access in tests
jest.mock("./storage", () => {
  const store: Record<string, string> = {};
  const mockStorage: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => {
        delete store[k];
      });
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };

  return {
    initLocalStorage: () => mockStorage,
    initSessionStorage: () => mockStorage,
    sessionId: () => "test-session-id",
    SessionManager: class {
      sessionId = "test-session-id";
      touch = jest.fn();
      activity = jest.fn();
    },
    getOrCreateClientId: () => "test-client-id",
  };
});

describe("Tracker", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: () => Promise.resolve({ query_id: "q-123" }),
    });
    global.fetch = fetchMock;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("start/stop", () => {
    it("uses ConsoleSink when no endpointHost", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const tracker = new Tracker({ application: "test" });
      tracker.start();
      tracker.stop();
      consoleSpy.mockRestore();
    });

    it("uses BatchSink when endpointHost is provided", () => {
      const tracker = new Tracker({
        application: "test",
        endpointHost: "https://api.example.com",
        siteId: "test-site",
      });
      tracker.start();
      // Verify it doesn't throw and starts properly
      tracker.stop();
    });

    it("flush() forces immediate delivery of queued events", async () => {
      const tracker = new Tracker({
        application: "test",
        endpointHost: "https://api.example.com",
        siteId: "test-site",
      });
      tracker.start();
      tracker.dispatch({
        action_name: "click",
        timestamp: "2025-01-01T00:00:00.000Z",
        event_attributes: {},
      });
      // Not sent yet - the batch interval has not elapsed.
      expect(fetchMock).not.toHaveBeenCalled();

      await tracker.flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.events).toHaveLength(1);
      tracker.stop();
    });

    it("flush() resolves without throwing when there is no batch sink", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const tracker = new Tracker({ application: "test" });
      tracker.start();

      await expect(tracker.flush()).resolves.toBeUndefined();

      tracker.stop();
      consoleSpy.mockRestore();
    });

    it("delivers events after a stop()/start() cycle (does not reuse a disposed sink)", () => {
      const emit = jest.fn();
      const sink = { emit };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);

      tracker.start();
      tracker.stop();
      tracker.start();

      tracker.dispatch({
        action_name: "click",
        timestamp: "2025-01-01T00:00:00.000Z",
        event_attributes: {},
      });

      expect(emit).toHaveBeenCalledTimes(1);
      tracker.stop();
    });

    it("keeps user-added sinks across a stop()/start() cycle", () => {
      const emit = jest.fn();
      const tracker = new Tracker({ application: "test" });
      tracker.start();
      tracker.addSink({ emit }); // added after start
      tracker.stop();
      tracker.start();

      tracker.dispatch({
        action_name: "view",
        timestamp: "2025-01-01T00:00:00.000Z",
        event_attributes: {},
      });

      expect(emit).toHaveBeenCalledTimes(1);
      tracker.stop();
    });

    it("drops events dispatched after stop() instead of buffering them", () => {
      const emit = jest.fn();
      const tracker = new Tracker({ application: "test" });
      tracker.addSink({ emit });
      tracker.start();
      tracker.stop();

      tracker.dispatch({ action_name: "late_click" });
      tracker.start();

      expect(emit).not.toHaveBeenCalled();
      tracker.stop();
    });

    it("stamps buffered pre-start events with the identity current at dispatch time", () => {
      const events: any[] = [];
      const tracker = new Tracker({ application: "test", userId: "user-1" });
      tracker.addSink({ emit: (e) => events.push(e) });

      tracker.dispatch({ action_name: "click" }); // buffered while user-1
      tracker.setUserId(undefined); // logout before start()
      tracker.dispatch({ action_name: "view" }); // buffered anonymous
      tracker.start();
      tracker.stop();

      expect(events).toHaveLength(2);
      expect(events[0].user_id).toBe("user-1");
      expect(events[1].user_id).toBeUndefined();
    });

    it("start is idempotent", () => {
      const tracker = new Tracker({ application: "test" });
      tracker.start();
      tracker.start(); // should not throw
      tracker.stop();
    });

    it("stop is idempotent", () => {
      const tracker = new Tracker({ application: "test" });
      tracker.start();
      tracker.stop();
      tracker.stop(); // should not throw
    });

    it("stop without start does not throw", () => {
      const tracker = new Tracker({ application: "test" });
      expect(() => tracker.stop()).not.toThrow();
    });
  });

  describe("high-level result API", () => {
    function trackerWithCapture() {
      const events: any[] = [];
      const tracker = new Tracker({ application: "test" });
      tracker.addSink({ emit: (e) => events.push(e) });
      tracker.start();
      return { tracker, events };
    }

    it("trackResultClick builds a canonical click event with query_id", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "SKU1",
        ordinal: 3,
        queryId: "q1",
        objectIdField: "sku",
        query: "shoes",
      });
      tracker.stop();

      expect(events).toHaveLength(1);
      const e = events[0];
      expect(e.action_name).toBe("click");
      expect(e.query_id).toBe("q1");
      expect(e.user_query).toBe("shoes");
      expect(e.event_attributes.object.object_id).toBe("SKU1");
      expect(e.event_attributes.object.object_id_field).toBe("sku");
      expect(e.event_attributes.position.ordinal).toBe(3);
    });

    it("trackResultImpression emits one canonical event per item", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultImpression({
        items: [
          { objectId: "a", ordinal: 1 },
          { objectId: "b", ordinal: 2 },
        ],
        queryId: "q1",
      });
      tracker.stop();

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.action_name === "impression")).toBe(true);
      expect(events.every((e) => e.query_id === "q1")).toBe(true);
      expect(events[0].event_attributes.object.object_id).toBe("a");
      expect(events[1].event_attributes.position.ordinal).toBe(2);
    });

    it("dedupes impressions per (queryId, objectId) across calls", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultImpression({
        items: [{ objectId: "dup-a", ordinal: 1 }],
        queryId: "q1",
      });
      tracker.trackResultImpression({
        items: [
          { objectId: "dup-a", ordinal: 1 },
          { objectId: "dup-b", ordinal: 2 },
        ],
        queryId: "q1",
      });
      tracker.stop();

      expect(events.map((e) => e.event_attributes.object.object_id)).toEqual([
        "dup-a",
        "dup-b",
      ]);
    });

    it("a new queryId re-fires the impression for the same object", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultImpression({
        items: [{ objectId: "dup-c", ordinal: 1 }],
        queryId: "q1",
      });
      tracker.trackResultImpression({
        items: [{ objectId: "dup-c", ordinal: 3 }],
        queryId: "q2",
      });
      tracker.stop();

      expect(events).toHaveLength(2);
      expect(events.map((e) => e.query_id)).toEqual(["q1", "q2"]);
    });

    it("impression dedup survives a stop()/start() cycle", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultImpression({
        items: [{ objectId: "dup-d", ordinal: 1 }],
        queryId: "q1",
      });
      tracker.stop();
      tracker.start();
      tracker.trackResultImpression({
        items: [{ objectId: "dup-d", ordinal: 1 }],
        queryId: "q1",
      });
      tracker.stop();

      expect(events).toHaveLength(1);
    });

    it("the impression dedup set is bounded and evicts the oldest pair", () => {
      const { tracker, events } = trackerWithCapture();

      for (let i = 0; i < 1000; i++) {
        tracker.trackResultImpression({
          items: [{ objectId: `evict-${i}`, ordinal: 1 }],
          queryId: "q1",
        });
      }
      // The set is full: the next new pair evicts evict-0...
      tracker.trackResultImpression({
        items: [{ objectId: "evict-final", ordinal: 1 }],
        queryId: "q1",
      });
      // ...so the evicted pair may fire again. Bounded memory, bounded harm.
      tracker.trackResultImpression({
        items: [{ objectId: "evict-0", ordinal: 1 }],
        queryId: "q1",
      });
      tracker.stop();

      expect(events).toHaveLength(1002);
    });

    it("trackResultEvent supports conversions via actionName", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultEvent({
        actionName: "add_to_cart",
        objectId: "x",
        ordinal: 1,
        queryId: "q1",
      });
      tracker.stop();

      expect(events[0].action_name).toBe("add_to_cart");
      expect(events[0].query_id).toBe("q1");
    });

    it("trackSearch dispatches a canonical search event", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const { tracker, events } = trackerWithCapture();

      tracker.trackSearch({ query: "shoes", queryId: "q1" });
      tracker.stop();

      expect(events).toHaveLength(1);
      const e = events[0];
      expect(e.action_name).toBe("search");
      expect(e.message_type).toBe("QUERY");
      expect(e.query_id).toBe("q1");
      expect(e.user_query).toBe("shoes");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("trackSearch warns once when a JS caller omits queryId while endpointHost is set", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const tracker = new Tracker({
        application: "test",
        siteId: "s",
        endpointHost: "https://api.example.com",
      });
      tracker.start();

      tracker.trackSearch({ query: "shoes" } as any);
      tracker.trackSearch({ query: "boots" } as any);
      tracker.stop();

      const searchWarnings = warnSpy.mock.calls.filter((c) =>
        String(c[0]).includes("queryId"),
      );
      expect(searchWarnings).toHaveLength(1);
      warnSpy.mockRestore();
    });

    it("trackSearch still delivers the event when queryId is missing", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const { tracker, events } = trackerWithCapture();

      tracker.trackSearch({ query: "shoes" } as any);
      tracker.stop();

      expect(events).toHaveLength(1);
      expect(events[0].action_name).toBe("search");
      expect(events[0].query_id).toBeUndefined();
      expect(events[0].user_query).toBe("shoes");
      warnSpy.mockRestore();
    });
  });

  describe("object-keyed attribution", () => {
    function trackerWithCapture() {
      const events: any[] = [];
      const tracker = new Tracker({ application: "test" });
      tracker.addSink({ emit: (e) => events.push(e) });
      tracker.start();
      return { tracker, events };
    }

    it("trackResultClick records attribution that trackResultEvent resolves", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "attr-a",
        ordinal: 3,
        queryId: "q1",
        query: "shoes",
      });
      tracker.trackResultEvent({
        actionName: "add_to_cart",
        objectId: "attr-a",
      });
      tracker.stop();

      expect(events).toHaveLength(2);
      const conversion = events[1];
      expect(conversion.action_name).toBe("add_to_cart");
      expect(conversion.query_id).toBe("q1");
      expect(conversion.user_query).toBe("shoes");
      expect(conversion.event_attributes.position.ordinal).toBe(3);
      expect(conversion.event_attributes.object.object_id).toBe("attr-a");
    });

    it("a second Tracker instance resolves attribution registered by the first (new page)", () => {
      const first = trackerWithCapture();
      first.tracker.trackResultClick({
        objectId: "attr-b",
        ordinal: 2,
        queryId: "q2",
      });
      first.tracker.stop();

      const second = trackerWithCapture();
      second.tracker.trackResultEvent({
        actionName: "purchase",
        objectId: "attr-b",
      });
      second.tracker.stop();

      expect(second.events).toHaveLength(1);
      expect(second.events[0].query_id).toBe("q2");
      expect(second.events[0].event_attributes.position.ordinal).toBe(2);
    });

    it("an explicit queryId matching the recorded click borrows its ordinal", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "attr-e",
        ordinal: 4,
        queryId: "q5",
        query: "keyboards",
      });
      // A grid conversion supplies the queryId from the DOM but no rank.
      tracker.trackResultEvent({
        actionName: "add_to_cart",
        objectId: "attr-e",
        queryId: "q5",
      });
      tracker.stop();

      const conversion = events[1];
      expect(conversion.query_id).toBe("q5");
      expect(conversion.event_attributes.position.ordinal).toBe(4);
      expect(conversion.user_query).toBe("keyboards");
    });

    it("an explicit queryId wins over the recorded attribution", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "attr-c",
        ordinal: 1,
        queryId: "q-old",
      });
      tracker.trackResultEvent({
        actionName: "add_to_cart",
        objectId: "attr-c",
        queryId: "q-new",
      });
      tracker.stop();

      const conversion = events[1];
      expect(conversion.query_id).toBe("q-new");
      // Explicit attribution skips resolution entirely, so no recorded
      // ordinal is borrowed and the event carries no position.
      expect(conversion.event_attributes.position).toBeUndefined();
    });

    it("getResultAttribution returns the recorded values", () => {
      const { tracker } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "attr-d",
        ordinal: 7,
        queryId: "q7",
        query: "headphones",
      });
      tracker.stop();

      expect(tracker.getResultAttribution("attr-d")).toEqual({
        queryId: "q7",
        ordinal: 7,
        query: "headphones",
      });
      expect(tracker.getResultAttribution("unknown")).toBeUndefined();
    });

    it("a conversion with no attribution warns once and is sent unattributed", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const events: any[] = [];
      const tracker = new Tracker({
        application: "test",
        siteId: "s",
        endpointHost: "https://api.example.com",
      });
      tracker.addSink({ emit: (e) => events.push(e) });
      tracker.start();

      tracker.trackResultEvent({
        actionName: "add_to_cart",
        objectId: "attr-none",
      });
      tracker.trackResultEvent({
        actionName: "purchase",
        objectId: "attr-none",
      });
      tracker.stop();

      expect(events).toHaveLength(2);
      expect(events[0].query_id).toBeUndefined();
      expect(events[0].event_attributes.object.object_id).toBe("attr-none");
      const attributionWarnings = warnSpy.mock.calls.filter((c) =>
        String(c[0]).includes("unattributed"),
      );
      expect(attributionWarnings).toHaveLength(1);
      warnSpy.mockRestore();
    });
  });

  describe("ordinal validation", () => {
    function trackerWithWarnSpy() {
      const events: any[] = [];
      const warn = jest.fn();
      const tracker = new Tracker({
        application: "test",
        logger: { debug: jest.fn(), info: jest.fn(), warn, error: jest.fn() },
      });
      tracker.addSink({ emit: (e) => events.push(e) });
      tracker.start();
      return { tracker, events, warn };
    }

    it("drops an invalid ordinal and warns once, keeping the event", () => {
      const { tracker, events, warn } = trackerWithWarnSpy();

      tracker.trackResultClick({
        objectId: "ord-1",
        ordinal: 0 as any,
        queryId: "q1",
      });
      tracker.trackResultClick({
        objectId: "ord-2",
        ordinal: 2.5 as any,
        queryId: "q1",
      });
      tracker.stop();

      expect(events).toHaveLength(2);
      expect(events[0].event_attributes.position).toBeUndefined();
      expect(events[1].event_attributes.position).toBeUndefined();
      const ordinalWarnings = warn.mock.calls.filter((c) =>
        String(c[0]).includes("ordinal"),
      );
      expect(ordinalWarnings).toHaveLength(1);
    });

    it("warns about a missing queryId even without an endpointHost", () => {
      const { tracker, warn } = trackerWithWarnSpy();

      tracker.trackSearch({ query: "shoes" } as any);
      tracker.stop();

      const queryIdWarnings = warn.mock.calls.filter((c) =>
        String(c[0]).includes("queryId"),
      );
      expect(queryIdWarnings).toHaveLength(1);
    });
  });

  describe("custom event attributes", () => {
    function trackerWithCapture() {
      const events: any[] = [];
      const tracker = new Tracker({ application: "test" });
      tracker.addSink({ emit: (e) => events.push(e) });
      tracker.start();
      return { tracker, events };
    }

    it("extra keys on a click land under event_attributes", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "attr-x1",
        ordinal: 2,
        queryId: "q1",
        badge: "sale",
        sale_price: 9.99,
      });
      tracker.stop();

      const attrs = events[0].event_attributes;
      expect(attrs.badge).toBe("sale");
      expect(attrs.sale_price).toBe(9.99);
      expect(attrs.object.object_id).toBe("attr-x1");
      expect(attrs.position.ordinal).toBe(2);
    });

    it("canonical keys win over colliding extras", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "attr-x2",
        ordinal: 1,
        queryId: "q1",
        object: { object_id: "spoofed" },
        position: { ordinal: 99 },
      });
      tracker.stop();

      expect(events[0].event_attributes.object.object_id).toBe("attr-x2");
      expect(events[0].event_attributes.position.ordinal).toBe(1);
    });

    it("extra keys on a search land under event_attributes", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackSearch({
        query: "shoes",
        queryId: "q1",
        filters: { brand: "acme", in_stock: true },
      });
      tracker.stop();

      expect(events[0].event_attributes.filters).toEqual({
        brand: "acme",
        in_stock: true,
      });
    });

    it("extra keys on a conversion land under event_attributes", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultEvent({
        actionName: "add_to_cart",
        objectId: "attr-x3",
        source: "carousel",
      });
      tracker.stop();

      expect(events[0].event_attributes.source).toBe("carousel");
    });

    it("click extras are per-event: a resolved conversion carries none", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultClick({
        objectId: "attr-x4",
        ordinal: 3,
        queryId: "q1",
        badge: "sale",
      });
      tracker.trackResultEvent({
        actionName: "add_to_cart",
        objectId: "attr-x4",
      });
      tracker.stop();

      expect(events[1].query_id).toBe("q1");
      expect(events[1].event_attributes.badge).toBeUndefined();
    });

    it("impression extras are per-item", () => {
      const { tracker, events } = trackerWithCapture();

      tracker.trackResultImpression({
        queryId: "q1",
        items: [
          { objectId: "attr-a", ordinal: 1, badge: "sale" },
          { objectId: "attr-b", ordinal: 2 },
        ],
      });
      tracker.stop();

      expect(events[0].event_attributes.badge).toBe("sale");
      expect(events[1].event_attributes.badge).toBeUndefined();
    });
  });

  describe("error isolation", () => {
    it("addEnricher does not throw on error", () => {
      const tracker = new Tracker({ application: "test" });
      expect(() => tracker.addEnricher(null as any)).not.toThrow();
    });

    it("trackResultClicks does not throw on error and returns a noop detach", () => {
      const tracker = new Tracker({ application: "test" });
      let detach: (() => void) | undefined;
      expect(() => {
        detach = tracker.trackResultClicks(null as any);
      }).not.toThrow();
      expect(() => detach?.()).not.toThrow();
    });

    it("trackResultClicks returns a noop detach when the collector cannot be created", () => {
      const tracker = new Tracker({ application: "test" });
      jest
        .spyOn(
          require("./collectors/ResultClickCollector"),
          "ResultClickCollector",
        )
        .mockImplementation(() => {
          throw new Error("constructor error");
        });
      const detach = tracker.trackResultClicks({ selector: ".x" });
      expect(typeof detach).toBe("function");
      expect(() => detach()).not.toThrow();
      jest.restoreAllMocks();
    });

    it("trackResultImpressions does not throw on error and returns a noop detach", () => {
      const tracker = new Tracker({ application: "test" });
      let detach: (() => void) | undefined;
      expect(() => {
        detach = tracker.trackResultImpressions(null as any);
      }).not.toThrow();
      expect(() => detach?.()).not.toThrow();
    });

    it("trackResultClick does not throw on null options", () => {
      const tracker = new Tracker({ application: "test" });
      expect(() => tracker.trackResultClick(null as any)).not.toThrow();
    });

    it("trackResultEvent does not throw on null options", () => {
      const tracker = new Tracker({ application: "test" });
      expect(() => tracker.trackResultEvent(null as any)).not.toThrow();
    });

    it("trackResultImpression does not throw on null options", () => {
      const tracker = new Tracker({ application: "test" });
      expect(() => tracker.trackResultImpression(null as any)).not.toThrow();
    });

    it("trackSearch does not throw on null options", () => {
      const tracker = new Tracker({ application: "test" });
      expect(() => tracker.trackSearch(null as any)).not.toThrow();
    });

    it("addSink does not throw on error", () => {
      const tracker = new Tracker({ application: "test" });
      // Add one sink, then add null to trigger error in AggregateSink branch
      tracker.addSink({ emit: jest.fn() });
      expect(() => tracker.addSink(null as any)).not.toThrow();
    });

    it("start does not throw on error", () => {
      const tracker = new Tracker({ application: "test" });
      // Force a situation that might cause an error
      expect(() => tracker.start()).not.toThrow();
      tracker.stop();
    });

    it("stop does not throw when detach throws", () => {
      const tracker = new Tracker({ application: "test" });
      jest
        .spyOn(ResultClickCollector.prototype, "attach")
        .mockReturnValue(() => {
          throw new Error("detach error");
        });
      tracker.trackResultClicks({ selector: ".x" });
      tracker.start();

      expect(() => tracker.stop()).not.toThrow();
    });
  });

  describe("addSink", () => {
    it("sets sink when none exists", () => {
      const tracker = new Tracker({ application: "test" });
      const sink = { emit: jest.fn() };
      tracker.addSink(sink);
      tracker.start();
      // Should not create default sink since one was provided
      tracker.stop();
    });

    it("creates AggregateSink for multiple sinks", () => {
      const tracker = new Tracker({ application: "test" });
      const sink1 = { emit: jest.fn() };
      const sink2 = { emit: jest.fn() };
      tracker.addSink(sink1);
      tracker.addSink(sink2);
      tracker.start();
      tracker.stop();
    });
  });

  describe("default logger", () => {
    it("routes diagnostics to the console by default", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const tracker = new Tracker({
        application: "test",
        siteId: "s",
        endpointHost: "https://api.example.com",
      });
      tracker.start();

      tracker.trackSearch({ query: "shoes" } as any);

      expect(warnSpy).toHaveBeenCalled();
      tracker.stop();
      warnSpy.mockRestore();
    });

    it("logs an error when endpointHost is set but siteId is missing", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      // Cast: the discriminated TrackerOptions makes this a type error, which
      // is the point; the runtime guard covers plain-JS callers.
      const tracker = new Tracker({
        application: "test",
        endpointHost: "https://api.example.com",
      } as any);

      tracker.start();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("siteId"));
      tracker.stop();
      errorSpy.mockRestore();
    });

    it("routes diagnostics through a replacement `logger` option (silences console)", () => {
      const warn = jest.fn();
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn,
        error: jest.fn(),
      };
      const consoleWarn = jest.spyOn(console, "warn").mockImplementation();

      const tracker = new Tracker({
        application: "test",
        siteId: "s",
        endpointHost: "https://api.example.com",
        logger,
      });
      tracker.start();
      // trackSearch without a queryId warns, via the replacement logger only.
      tracker.trackSearch({ query: "x" } as any);

      expect(warn).toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
      tracker.stop();
      consoleWarn.mockRestore();
    });

    it("a throwing consumer logger cannot escape the tracker", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(() => {
          throw new Error("logger boom");
        }),
        error: jest.fn(),
      };
      const tracker = new Tracker({
        application: "test",
        siteId: "s",
        endpointHost: "https://api.example.com",
        logger,
      });
      tracker.start();

      // trackSearch without a queryId warns via the logger, which throws.
      expect(() => tracker.trackSearch({ query: "x" } as any)).not.toThrow();
      tracker.stop();
      expect(logger.warn).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("debug producer: every dispatched event is logged at debug level", () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const tracker = new Tracker({ application: "test", logger });
      tracker.addSink({ emit: jest.fn() });
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      expect(logger.debug).toHaveBeenCalledWith(
        "ubi: dispatching event",
        expect.objectContaining({ action_name: "click" }),
      );
      tracker.stop();
    });

    it("delivery outcomes are logged at info level", async () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const tracker = new Tracker({
        application: "test",
        siteId: "s",
        endpointHost: "https://api.example.com",
        logger,
      });
      tracker.start();
      tracker.dispatch({ action_name: "click" });

      await tracker.flush();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("sent 1 event"),
      );
      tracker.stop();
    });
  });

  describe("collector registration", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("attaches a collector created after start()", () => {
      document.body.innerHTML =
        '<div data-query-id="q-late">' +
        '<button data-object-id="late-p1" data-ordinal="4">B</button>' +
        "</div>";
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);
      tracker.start();

      tracker.trackResultClicks({ selector: "[data-object-id]" });
      (document.querySelector("button") as HTMLElement).click();

      expect(sink.emit).toHaveBeenCalledTimes(1);
      const event = sink.emit.mock.calls[0][0];
      expect(event.action_name).toBe("click");
      expect(event.query_id).toBe("q-late");
      expect(event.event_attributes.position.ordinal).toBe(4);
      tracker.stop();
    });

    it("the returned detach stops collection while the tracker keeps running", () => {
      document.body.innerHTML =
        '<div data-query-id="q-detach">' +
        '<button data-object-id="detach-p1" data-ordinal="1">B</button>' +
        "</div>";
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);
      const detach = tracker.trackResultClicks({
        selector: "[data-object-id]",
      });
      tracker.start();

      detach();
      (document.querySelector("button") as HTMLElement).click();

      expect(sink.emit).not.toHaveBeenCalled();
      tracker.stop();
    });
  });

  describe("setUserId", () => {
    function trackerWithCapture() {
      const events: any[] = [];
      const tracker = new Tracker({ application: "test" });
      tracker.addSink({ emit: (e) => events.push(e) });
      return { tracker, events };
    }

    it("applies to events dispatched after the call", () => {
      const { tracker, events } = trackerWithCapture();
      tracker.start();
      tracker.dispatch({ action_name: "a" });
      tracker.setUserId("u-1");
      tracker.dispatch({ action_name: "b" });
      tracker.stop();

      expect(events[0].user_id).toBeUndefined();
      expect(events[1].user_id).toBe("u-1");
    });

    it("clears the user id with undefined (logout)", () => {
      const { tracker, events } = trackerWithCapture();
      tracker.start();
      tracker.setUserId("u-1");
      tracker.dispatch({ action_name: "a" });
      tracker.setUserId(undefined);
      tracker.dispatch({ action_name: "b" });
      tracker.stop();

      expect(events[0].user_id).toBe("u-1");
      expect(events[1].user_id).toBeUndefined();
    });

    it("is callable before start()", () => {
      const { tracker, events } = trackerWithCapture();
      tracker.setUserId("early");
      tracker.start();
      tracker.dispatch({ action_name: "a" });
      tracker.stop();

      expect(events[0].user_id).toBe("early");
    });

    it("an explicit user_id on the event still wins", () => {
      const { tracker, events } = trackerWithCapture();
      tracker.setUserId("ambient");
      tracker.start();
      tracker.dispatch({ action_name: "a", user_id: "explicit" });
      tracker.stop();

      expect(events[0].user_id).toBe("explicit");
    });
  });

  describe("clientId", () => {
    it("exposes clientId getter", () => {
      const tracker = new Tracker({ application: "test" });
      expect(tracker.clientId).toBe("test-client-id");
    });
  });

  describe("end-to-end", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("dispatch enriches event with all built-in fields", () => {
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "my-app" });
      tracker.addSink(sink);
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      expect(sink.emit).toHaveBeenCalledTimes(1);
      const event = sink.emit.mock.calls[0][0];
      expect(event.action_name).toBe("click");
      expect(event.application).toBe("my-app");
      expect(event.session_id).toBe("test-session-id");
      expect(event.client_id).toBe("test-client-id");
      expect(event.timestamp).toEqual(expect.any(String));
      expect(event.event_attributes.browser).toEqual(
        expect.objectContaining({
          user_agent: expect.any(String),
          language: expect.any(String),
          resolution: expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        }),
      );
      expect(event.event_attributes.page).toEqual(
        expect.objectContaining({
          url: expect.any(String),
          title: expect.any(String),
        }),
      );

      tracker.stop();
    });

    it("userId option appears in enriched events", () => {
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({
        application: "test",
        userId: "u-1",
      });
      tracker.addSink(sink);
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      expect(sink.emit.mock.calls[0][0].user_id).toBe("u-1");
      tracker.stop();
    });

    it("custom enricher contributes to emitted event", () => {
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);
      tracker.addEnricher({
        enrich(event) {
          if (!event.event_attributes) event.event_attributes = {};
          event.event_attributes.custom = "hello";
        },
      });
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      const event = sink.emit.mock.calls[0][0];
      expect(event.event_attributes.custom).toBe("hello");
      expect(event.application).toBe("test");
      tracker.stop();
    });

    it("the disposer returned by addEnricher stops it from contributing", () => {
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);
      const dispose = tracker.addEnricher({
        enrich(event) {
          if (!event.event_attributes) event.event_attributes = {};
          event.event_attributes.custom = "hello";
        },
      });
      dispose();
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      const event = sink.emit.mock.calls[0][0];
      expect(event.event_attributes?.custom).toBeUndefined();
      tracker.stop();
    });

    it("the disposer returned by addSink stops it from receiving events", () => {
      const kept = { emit: jest.fn() };
      const removed = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(kept);
      const dispose = tracker.addSink(removed);
      tracker.start();

      tracker.dispatch({ action_name: "click" });
      dispose();
      tracker.dispatch({ action_name: "view" });

      expect(removed.emit).toHaveBeenCalledTimes(1);
      expect(kept.emit).toHaveBeenCalledTimes(2);
      tracker.stop();
    });

    it("multiple sinks both receive the event", () => {
      const sink1 = { emit: jest.fn() };
      const sink2 = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink1);
      tracker.addSink(sink2);
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      expect(sink1.emit).toHaveBeenCalledTimes(1);
      expect(sink2.emit).toHaveBeenCalledTimes(1);
      expect(sink1.emit.mock.calls[0][0].action_name).toBe("click");
      expect(sink2.emit.mock.calls[0][0].action_name).toBe("click");
      tracker.stop();
    });

    it("buffers dispatches before start and replays them on start()", () => {
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);

      tracker.dispatch({ action_name: "click" });
      expect(sink.emit).not.toHaveBeenCalled();

      tracker.start();

      expect(sink.emit).toHaveBeenCalledTimes(1);
      expect(sink.emit.mock.calls[0][0].action_name).toBe("click");
      // Stamped with the moment it happened, not the replay.
      expect(sink.emit.mock.calls[0][0].timestamp).toEqual(expect.any(String));
      tracker.stop();
    });

    it("bounds the pre-start buffer and warns once on overflow", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);

      for (let i = 0; i < 105; i++) {
        tracker.dispatch({ action_name: `a${i}` });
      }
      tracker.start();

      expect(sink.emit).toHaveBeenCalledTimes(100);
      // The oldest were dropped; the newest survive.
      expect(sink.emit.mock.calls[0][0].action_name).toBe("a5");
      const overflowWarnings = warnSpy.mock.calls.filter((c) =>
        String(c[0]).includes("before start()"),
      );
      expect(overflowWarnings).toHaveLength(1);
      tracker.stop();
      warnSpy.mockRestore();
    });

    it("preserves caller-provided fields", () => {
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);
      tracker.start();

      tracker.dispatch({
        action_name: "click",
        query_id: "q-existing",
        user_query: "red shoes",
      });

      const event = sink.emit.mock.calls[0][0];
      expect(event.query_id).toBe("q-existing");
      expect(event.user_query).toBe("red shoes");
      tracker.stop();
    });

    it("trackResultClicks fires a canonical enriched event through the pipeline", () => {
      document.body.innerHTML =
        '<div data-query-id="q-e2e" data-query="mice">' +
        '<a data-object-id="p-42" data-ordinal="2"><span>hit</span></a>' +
        "</div>";
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);
      tracker.trackResultClicks({ selector: "[data-object-id]" });
      tracker.start();

      (document.querySelector("span") as HTMLElement).click();

      expect(sink.emit).toHaveBeenCalledTimes(1);
      const event = sink.emit.mock.calls[0][0];
      expect(event.action_name).toBe("click");
      expect(event.query_id).toBe("q-e2e");
      expect(event.user_query).toBe("mice");
      expect(event.event_attributes.object.object_id).toBe("p-42");
      expect(event.event_attributes.position.ordinal).toBe(2);
      expect(event.application).toBe("test");
      tracker.stop();
    });

    it("enricher error does not block event emission", () => {
      const sink = { emit: jest.fn() };
      const tracker = new Tracker({ application: "test" });
      tracker.addSink(sink);
      tracker.addEnricher({
        enrich() {
          throw new Error("enricher failed");
        },
      });
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      expect(sink.emit).toHaveBeenCalledTimes(1);
      expect(sink.emit.mock.calls[0][0].application).toBe("test");
      tracker.stop();
    });

    it("logger receives error when enricher throws", () => {
      const sink = { emit: jest.fn() };
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const tracker = new Tracker({ application: "test", logger });
      tracker.addSink(sink);
      tracker.addEnricher({
        enrich() {
          throw new Error("boom");
        },
      });
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      expect(logger.error).toHaveBeenCalled();
      expect(sink.emit).toHaveBeenCalledTimes(1);
      tracker.stop();
    });

    it("ConsoleSink logs enriched event when no endpointHost", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const tracker = new Tracker({ application: "test" });
      tracker.start();

      tracker.dispatch({ action_name: "click" });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const event = consoleSpy.mock.calls[0][0];
      expect(event.action_name).toBe("click");
      expect(event.application).toBe("test");

      tracker.stop();
      consoleSpy.mockRestore();
    });
  });
});
