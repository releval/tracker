import type { Event as UbiEvent } from "../types";
import { BatchSink } from "./BatchSink";

function createEvent(overrides: Partial<UbiEvent> = {}): UbiEvent {
  return {
    action_name: "click",
    timestamp: "2025-01-01T00:00:00.000Z",
    event_attributes: { position: {} },
    ...overrides,
  };
}

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => {
        delete store[k];
      });
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

describe("BatchSink", () => {
  let fetchMock: jest.Mock;
  let sendBeaconMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    sendBeaconMock = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeaconMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function createSink(overrides: Record<string, any> = {}): BatchSink {
    return new BatchSink({
      endpointHost: "https://api.example.com",
      storage: createMockStorage(),
      flushIntervalMs: 1000,
      flushSize: 3,
      ...overrides,
    });
  }

  describe("batching", () => {
    it("queues events without sending immediately", () => {
      const sink = createSink();
      sink.emit(createEvent());

      expect(fetchMock).not.toHaveBeenCalled();
      expect(sink.pendingCount).toBe(1);
      sink.dispose();
    });

    it("flushes when queue reaches flushSize", () => {
      const sink = createSink({ flushSize: 2 });

      sink.emit(createEvent({ action_name: "click" }));
      sink.emit(createEvent({ action_name: "view" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.events).toHaveLength(2);
      expect(body.events[0].action_name).toBe("click");
      expect(body.events[1].action_name).toBe("view");
      expect(sink.pendingCount).toBe(0);
      sink.dispose();
    });

    it("flushes on timer interval", () => {
      const sink = createSink({ flushIntervalMs: 500 });
      sink.emit(createEvent());

      expect(fetchMock).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      sink.dispose();
    });

    it("does not send empty batches on timer", () => {
      const sink = createSink({ flushIntervalMs: 500 });

      jest.advanceTimersByTime(500);

      expect(fetchMock).not.toHaveBeenCalled();
      sink.dispose();
    });

    it("sends batch as an {events:[...]} envelope to the Releval track-event URL", () => {
      const sink = createSink({ flushSize: 1 });
      sink.emit(createEvent());

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/ubi/track-event",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(Array.isArray(body)).toBe(false);
      expect(Array.isArray(body.events)).toBe(true);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].action_name).toBe("click");
      sink.dispose();
    });
  });

  describe("flush()", () => {
    it("sends current queue and clears it", async () => {
      const sink = createSink();
      sink.emit(createEvent());
      sink.emit(createEvent());

      await sink.flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.events).toHaveLength(2);
      expect(sink.pendingCount).toBe(0);
      sink.dispose();
    });

    it("resolves immediately when queue is empty", async () => {
      const sink = createSink();
      await sink.flush();
      expect(fetchMock).not.toHaveBeenCalled();
      sink.dispose();
    });
  });

  describe("retry logic", () => {
    it("retries on 500 server error", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true });

      const sink = createSink({ flushSize: 1, retryBaseDelayMs: 100 });
      sink.emit(createEvent());

      // Wait for first attempt to fail
      await Promise.resolve();

      // Advance past retry delay
      jest.advanceTimersByTime(200);
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      sink.dispose();
    });

    it("retries on 429 rate limit", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: true });

      const sink = createSink({ flushSize: 1, retryBaseDelayMs: 100 });
      sink.emit(createEvent());

      await Promise.resolve();
      jest.advanceTimersByTime(200);
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      sink.dispose();
    });

    it("does not retry on 400 client error", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 });
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const sink = createSink({ flushSize: 1, logger });
      sink.emit(createEvent());

      await Promise.resolve();
      jest.advanceTimersByTime(10000);
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalled();
      sink.dispose();
    });

    it("retries on network error", async () => {
      fetchMock
        .mockRejectedValueOnce(new Error("Network failure"))
        .mockResolvedValueOnce({ ok: true });

      const sink = createSink({ flushSize: 1, retryBaseDelayMs: 100 });
      sink.emit(createEvent());

      await Promise.resolve();
      jest.advanceTimersByTime(200);
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      sink.dispose();
    });

    it("stops retrying after maxRetries", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const sink = createSink({
        flushSize: 1,
        maxRetries: 2,
        retryBaseDelayMs: 50,
        retryMaxDelayMs: 100,
        logger,
      });
      sink.emit(createEvent());

      // Run through all retries
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(200);
      }
      await Promise.resolve();

      // initial + 2 retries = 3 total
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed after 2 attempts"),
      );
      sink.dispose();
    });
  });

  describe("unload delivery", () => {
    it("sends via keepalive fetch on visibilitychange to hidden", () => {
      // Kept from when this path used a Blob, so a regression back to
      // sendBeacon would still be caught by the assertions below.
      const captured: string[] = [];
      const RealBlob = global.Blob;
      class CapturingBlob extends RealBlob {
        constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
          super(parts, opts);
          captured.push(String(parts[0]));
        }
      }
      global.Blob = CapturingBlob as unknown as typeof Blob;

      try {
        const sink = createSink();
        sink.emit(createEvent());
        sink.emit(createEvent());
        fetchMock.mockClear();

        // Simulate visibilitychange to hidden
        Object.defineProperty(document, "visibilityState", {
          value: "hidden",
          writable: true,
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));

        expect(sendBeaconMock).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe(
          "https://api.example.com/api/v1/ubi/track-event",
        );
        const init = fetchMock.mock.calls[0][1];
        expect(init.keepalive).toBe(true);
        expect(init.headers["Content-Type"]).toBe("application/json");
        const body = JSON.parse(init.body);
        expect(Array.isArray(body.events)).toBe(true);
        expect(body.events).toHaveLength(2);
        expect(sink.pendingCount).toBe(0);

        sink.dispose();
      } finally {
        global.Blob = RealBlob;
        // Restore
        Object.defineProperty(document, "visibilityState", {
          value: "visible",
          writable: true,
          configurable: true,
        });
      }
    });

    it("does not send beacon when queue is empty", () => {
      const sink = createSink();

      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(sendBeaconMock).not.toHaveBeenCalled();
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      sink.dispose();
    });

    it("does not send beacon on visibilitychange to visible", () => {
      const sink = createSink();
      sink.emit(createEvent());

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(sendBeaconMock).not.toHaveBeenCalled();
      sink.dispose();
    });
  });

  describe("localStorage persistence", () => {
    it("persists events to storage on dispose when beacon fails", () => {
      sendBeaconMock.mockImplementation(() => {
        throw new Error("Beacon failed");
      });
      fetchMock.mockImplementation(() => {
        throw new Error("fetch failed too");
      });

      const storage = createMockStorage();
      const sink = createSink({ storage });
      sink.emit(createEvent());

      sink.dispose();

      expect(storage.setItem).toHaveBeenCalledWith(
        "_ubi_batch_retry_https-api-example-com_",
        expect.any(String),
      );
    });

    it("namespaces the retry queue by endpoint", () => {
      const storage = createMockStorage();
      storage.setItem(
        "_ubi_batch_retry_https-other-host_",
        JSON.stringify([
          { events: [createEvent()], attempt: 0, ts: Date.now() },
        ]),
      );

      const sink = createSink({ storage });

      // Another endpoint's queue is not this sink's to drain.
      expect(
        storage.getItem("_ubi_batch_retry_https-other-host_"),
      ).not.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      sink.dispose();
    });

    it("drains stored retries on construction", async () => {
      const storage = createMockStorage();
      const storedBatch = [
        {
          events: [createEvent({ action_name: "stored_click" })],
          attempt: 0,
          ts: Date.now(),
        },
      ];
      storage.setItem(
        "_ubi_batch_retry_https-api-example-com_",
        JSON.stringify(storedBatch),
      );

      const sink = createSink({ storage });

      // Should have cleared storage and sent the batch
      expect(storage.removeItem).toHaveBeenCalledWith(
        "_ubi_batch_retry_https-api-example-com_",
      );
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.events[0].action_name).toBe("stored_click");
      sink.dispose();
    });
  });

  describe("dispose", () => {
    it("stops the flush timer", () => {
      const sink = createSink({ flushIntervalMs: 500 });
      sink.emit(createEvent());
      sink.dispose();
      // dispose() delivers the remainder over the unload path, which is now a
      // keepalive fetch; clear it so the timer is the only thing under test.
      fetchMock.mockClear();

      jest.advanceTimersByTime(1000);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("removes visibilitychange listener", () => {
      const sink = createSink();
      sink.dispose();
      sink.emit(createEvent()); // should be ignored (disposed)

      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(sendBeaconMock).not.toHaveBeenCalled();
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
    });

    it("ignores emit after dispose", () => {
      const sink = createSink({ flushSize: 1 });
      sink.dispose();

      sink.emit(createEvent());

      expect(fetchMock).not.toHaveBeenCalled();
      expect(sink.pendingCount).toBe(0);
    });
  });

  describe("delivery hardening", () => {
    it("flushes via keepalive fetch on pagehide (the terminal-click path)", () => {
      const sink = createSink();
      sink.emit(createEvent());
      fetchMock.mockClear();

      window.dispatchEvent(new Event("pagehide"));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
      expect(sink.pendingCount).toBe(0);
      sink.dispose();
    });

    it("never uses sendBeacon for the terminal click when fetch is available", () => {
      // A beacon posts an application/json Blob, which is not CORS-safelisted,
      // so cross-origin the browser drops it after sendBeacon has already
      // returned true. "Queued" is not "delivered", nothing falls back, and the
      // click that CTR depends on is lost. Reporting to another origin is the
      // normal deployment, so the beacon must not be reached here.
      const sink = createSink();
      sink.emit(createEvent());
      fetchMock.mockClear();

      window.dispatchEvent(new Event("pagehide"));

      expect(sendBeaconMock).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      sink.dispose();
    });

    it("falls back to sendBeacon when fetch is unavailable", () => {
      const realFetch = global.fetch;
      // @ts-expect-error - modelling an environment without fetch
      delete global.fetch;
      try {
        const sink = createSink();
        sink.emit(createEvent());

        window.dispatchEvent(new Event("pagehide"));

        expect(sendBeaconMock).toHaveBeenCalledTimes(1);
        sink.dispose();
      } finally {
        global.fetch = realFetch;
      }
    });

    it("sends the normal flush without keepalive (reserves the keepalive budget for unload)", async () => {
      const sink = createSink({ flushSize: 1 });
      sink.emit(createEvent());
      await Promise.resolve();

      expect(fetchMock.mock.calls[0][1].keepalive).toBeUndefined();
      sink.dispose();
    });

    it("persists in-flight retry batches on a real unload (pagehide)", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 }); // schedules a retry
      const storage = createMockStorage();
      const sink = createSink({ flushSize: 1, storage });
      sink.emit(createEvent({ action_name: "terminal" }));
      await Promise.resolve(); // let sendBatch resolve -> scheduleRetry

      // Real unload: the retry timer would die with the page, so it is persisted.
      window.dispatchEvent(new Event("pagehide"));

      expect(storage.setItem).toHaveBeenCalledWith(
        "_ubi_batch_retry_https-api-example-com_",
        expect.any(String),
      );
      const persisted = JSON.parse(
        (storage.setItem as jest.Mock).mock.calls.at(-1)![1],
      );
      expect(persisted[0].events[0].action_name).toBe("terminal");
      sink.dispose();
    });

    it("persists in-flight retries on visibilitychange to hidden (mobile discard path)", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 }); // schedules a retry
      const storage = createMockStorage();
      const sink = createSink({ flushSize: 1, storage });
      sink.emit(createEvent({ action_name: "terminal" }));
      await Promise.resolve(); // let sendBatch resolve -> scheduleRetry

      // A backgrounded tab can be discarded after visibilitychange->hidden
      // without ever firing pagehide, so the retry must be persisted here too.
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      const persisted = JSON.parse(
        (storage.setItem as jest.Mock).mock.calls.at(-1)![1],
      );
      expect(persisted[0].events[0].action_name).toBe("terminal");

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      sink.dispose();
    });

    it("resumes persisted retries on visibilitychange to visible", async () => {
      const storage = createMockStorage();
      const sink = createSink({ flushSize: 1, storage });
      // Seed AFTER construction so the constructor drain does not consume it.
      storage.setItem(
        "_ubi_batch_retry_https-api-example-com_",
        JSON.stringify([
          {
            events: [createEvent({ action_name: "resumed" })],
            attempt: 1,
            ts: Date.now(),
          },
        ]),
      );
      fetchMock.mockClear();

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(storage.removeItem).toHaveBeenCalledWith(
        "_ubi_batch_retry_https-api-example-com_",
      );
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.events[0].action_name).toBe("resumed");
      sink.dispose();
    });

    it("does not persist retries on a bfcache pagehide (event.persisted)", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const storage = createMockStorage();
      const sink = createSink({ flushSize: 1, storage });
      sink.emit(createEvent());
      await Promise.resolve();
      (storage.setItem as jest.Mock).mockClear();

      const bfcacheEvent = new Event("pagehide") as PageTransitionEvent;
      Object.defineProperty(bfcacheEvent, "persisted", { value: true });
      window.dispatchEvent(bfcacheEvent);

      expect(storage.setItem).not.toHaveBeenCalled();
      sink.dispose();
    });

    it("uses full jitter so backoff stays within [0, cappedDelay]", () => {
      const sink = createSink({
        retryBaseDelayMs: 1000,
        retryMaxDelayMs: 30000,
      });
      const backoff = (
        sink as unknown as { calculateBackoff(n: number): number }
      ).calculateBackoff;
      jest.spyOn(Math, "random").mockReturnValue(0.999999);
      // attempt 3 -> cappedDelay = min(1000 * 8, 30000) = 8000
      const delay = backoff.call(sink, 3);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(8000);
      (Math.random as jest.Mock).mockRestore();
      sink.dispose();
    });
  });
});
