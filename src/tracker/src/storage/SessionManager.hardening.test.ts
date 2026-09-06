import type { Logger } from "../logging";
import { getOrCreateClientId } from "./ClientId";
import { SessionManager } from "./SessionManager";

function makeStorage(overrides?: Partial<Storage>): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    ...overrides,
  };
}

function makeLogger(): Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe("SessionManager hardening", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("activity() keeps the session alive without any event", () => {
    const manager = new SessionManager({
      storage: makeStorage(),
      inactivityTimeoutMs: 1000,
    });
    const id = manager.sessionId;

    jest.setSystemTime(Date.now() + 900);
    manager.activity();
    jest.setSystemTime(Date.now() + 900);
    expect(manager.sessionId).toBe(id);

    jest.setSystemTime(Date.now() + 1100);
    expect(manager.sessionId).not.toBe(id);
  });

  it("does not throw when the storage write fails, and logs it", () => {
    const logger = makeLogger();
    const storage = makeStorage({
      setItem: () => {
        throw new Error("quota");
      },
    });

    let manager: SessionManager | undefined;
    expect(() => {
      manager = new SessionManager({ storage, logger });
    }).not.toThrow();
    expect(() => manager?.touch()).not.toThrow();
    expect(typeof manager?.sessionId).toBe("string");
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("getOrCreateClientId hardening", () => {
  it("returns a generated id and logs when the write fails", () => {
    const logger = makeLogger();
    const storage = makeStorage({
      setItem: () => {
        throw new Error("quota");
      },
    });

    let id = "";
    expect(() => {
      id = getOrCreateClientId(storage, logger);
    }).not.toThrow();
    expect(id.length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns a generated id when reads throw too", () => {
    const storage = makeStorage({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });

    expect(getOrCreateClientId(storage).length).toBeGreaterThan(0);
  });
});
