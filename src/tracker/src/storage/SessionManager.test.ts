import { SessionManager } from "./SessionManager";

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
    clear: jest.fn(),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

const THIRTY_MINUTES = 30 * 60 * 1000;
const _TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

describe("SessionManager", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("generates a session ID on construction", () => {
    const manager = new SessionManager({ storage: createMockStorage() });
    expect(manager.sessionId).toBeTruthy();
    expect(typeof manager.sessionId).toBe("string");
  });

  it("returns the same session ID within timeout period", () => {
    const manager = new SessionManager({ storage: createMockStorage() });
    const first = manager.sessionId;

    jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
    manager.touch();

    expect(manager.sessionId).toBe(first);
  });

  it("rotates session after inactivity timeout (30 min default)", () => {
    const manager = new SessionManager({ storage: createMockStorage() });
    const first = manager.sessionId;
    manager.touch();

    jest.advanceTimersByTime(THIRTY_MINUTES + 1);

    expect(manager.sessionId).not.toBe(first);
  });

  it("does not rotate if touch is called within timeout", () => {
    const manager = new SessionManager({ storage: createMockStorage() });
    const first = manager.sessionId;

    // Touch every 10 minutes for an hour
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(10 * 60 * 1000);
      manager.touch();
    }

    expect(manager.sessionId).toBe(first);
  });

  it("rotates session after max duration (24 hours default)", () => {
    const manager = new SessionManager({ storage: createMockStorage() });
    const first = manager.sessionId;

    // Keep touching every 10 minutes for 24 hours
    for (let i = 0; i < 144; i++) {
      jest.advanceTimersByTime(10 * 60 * 1000);
      manager.touch();
    }

    jest.advanceTimersByTime(1); // just past 24h
    expect(manager.sessionId).not.toBe(first);
  });

  it("uses custom inactivity timeout", () => {
    const manager = new SessionManager({
      storage: createMockStorage(),
      inactivityTimeoutMs: 5 * 60 * 1000, // 5 minutes
    });
    const first = manager.sessionId;
    manager.touch();

    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(manager.sessionId).not.toBe(first);
  });

  it("uses custom max duration", () => {
    const manager = new SessionManager({
      storage: createMockStorage(),
      maxSessionDurationMs: 60 * 60 * 1000, // 1 hour
    });
    const first = manager.sessionId;

    // Touch every 10 minutes for 1 hour
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(10 * 60 * 1000);
      manager.touch();
    }

    jest.advanceTimersByTime(1);
    expect(manager.sessionId).not.toBe(first);
  });

  it("restores session from storage", () => {
    const storage = createMockStorage();
    const first = new SessionManager({ storage });
    const sessionId = first.sessionId;
    first.touch();

    // Simulate page reload
    const second = new SessionManager({ storage });
    expect(second.sessionId).toBe(sessionId);
  });

  it("handles corrupted storage gracefully", () => {
    const storage = createMockStorage();
    storage.setItem("_ubi_session_", "not-json");

    const manager = new SessionManager({ storage });
    expect(manager.sessionId).toBeTruthy();
  });

  it("handles incomplete stored data", () => {
    const storage = createMockStorage();
    storage.setItem("_ubi_session_", JSON.stringify({ id: "test" }));

    const manager = new SessionManager({ storage });
    // Should create a new session since createdAt/lastActivity are missing
    expect(manager.sessionId).not.toBe("test");
  });

  it("rejects stored data with far-future timestamps (clock skew)", () => {
    const storage = createMockStorage();
    storage.setItem(
      "_ubi_session_",
      JSON.stringify({
        id: "future-session",
        createdAt: Date.now() + 60 * 60 * 1000,
        lastActivity: Date.now() + 60 * 60 * 1000,
      }),
    );

    const manager = new SessionManager({ storage });

    // A far-future lastActivity would otherwise pin the session alive forever.
    expect(manager.sessionId).not.toBe("future-session");
  });

  it("rejects stored data with non-numeric timestamps", () => {
    const storage = createMockStorage();
    storage.setItem(
      "_ubi_session_",
      JSON.stringify({
        id: "bad-session",
        createdAt: "not-a-number",
        lastActivity: "also-not-a-number",
      }),
    );

    const manager = new SessionManager({ storage });

    expect(manager.sessionId).not.toBe("bad-session");
  });

  it("persists session data to storage", () => {
    const storage = createMockStorage();
    const manager = new SessionManager({ storage });
    manager.sessionId; // trigger load

    expect(storage.setItem).toHaveBeenCalledWith(
      "_ubi_session_",
      expect.any(String),
    );
    const stored = JSON.parse((storage.setItem as jest.Mock).mock.calls[0][1]);
    expect(stored.id).toBeTruthy();
    expect(stored.createdAt).toBeTruthy();
    expect(stored.lastActivity).toBeTruthy();
  });

  it("adopts a different session persisted by another tab (convergence)", () => {
    const storage = createMockStorage();
    const manager = new SessionManager({ storage });
    const original = manager.sessionId;

    // Another tab rotated to a fresh session.
    storage.setItem(
      "_ubi_session_",
      JSON.stringify({
        id: "other-tab-session",
        createdAt: Date.now(),
        lastActivity: Date.now(),
      }),
    );

    expect(manager.sessionId).toBe("other-tab-session");
    expect(manager.sessionId).not.toBe(original);
  });

  it("does not expire when another tab keeps the session alive", () => {
    const storage = createMockStorage();
    const manager = new SessionManager({
      storage,
      inactivityTimeoutMs: THIRTY_MINUTES,
    });
    const id = manager.sessionId;

    // This tab idles past the inactivity timeout for its in-memory copy...
    jest.advanceTimersByTime(THIRTY_MINUTES + 1000);
    // ...but another tab kept the same session alive (fresh lastActivity).
    const stored = JSON.parse(storage.getItem("_ubi_session_") as string);
    stored.lastActivity = Date.now();
    storage.setItem("_ubi_session_", JSON.stringify(stored));

    expect(manager.sessionId).toBe(id); // adopted the heartbeat, did not rotate
  });
});
