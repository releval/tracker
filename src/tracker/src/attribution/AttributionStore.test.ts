import type { Logger } from "../logging";
import { AttributionStore } from "./AttributionStore";

function makeStorage(): Storage {
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

describe("AttributionStore", () => {
  let localStorage: Storage;
  let sessionStorage: Storage;
  let sessionId: string;
  let logger: Logger;

  const makeStore = (overrides?: { sessionStorage?: Storage }) =>
    new AttributionStore({
      localStorage,
      sessionStorage: overrides?.sessionStorage ?? sessionStorage,
      sessionId: () => sessionId,
      logger: () => logger,
    });

  beforeEach(() => {
    localStorage = makeStorage();
    sessionStorage = makeStorage();
    sessionId = "session-1";
    logger = makeLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a registered record", () => {
    const store = makeStore();
    store.register("SKU1", { queryId: "q1", ordinal: 3, query: "shoes" });

    expect(store.get("SKU1")).toEqual({
      queryId: "q1",
      ordinal: 3,
      query: "shoes",
    });
  });

  it("keeps a record with only a queryId", () => {
    const store = makeStore();
    store.register("SKU1", { queryId: "q1" });

    expect(store.get("SKU1")).toEqual({ queryId: "q1" });
  });

  it("returns undefined for an unknown object", () => {
    expect(makeStore().get("nope")).toBeUndefined();
  });

  it("performs no storage IO at construction", () => {
    const setItem = jest.spyOn(sessionStorage, "setItem");
    const getItem = jest.spyOn(sessionStorage, "getItem");
    makeStore();
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("resolves from localStorage when sessionStorage has no copy (new tab)", () => {
    const store = makeStore();
    store.register("SKU1", { queryId: "q1", ordinal: 2 });

    // A new tab shares localStorage but starts with empty sessionStorage.
    const newTab = makeStore({ sessionStorage: makeStorage() });
    expect(newTab.get("SKU1")).toEqual({ queryId: "q1", ordinal: 2 });
  });

  it("does not resolve a record registered in a different session, and prunes it", () => {
    const store = makeStore();
    store.register("SKU1", { queryId: "q1" });

    sessionId = "session-2";
    expect(store.get("SKU1")).toBeUndefined();

    // Pruned from both storages, so a return to session-1 cannot revive it.
    sessionId = "session-1";
    expect(store.get("SKU1")).toBeUndefined();
  });

  it("does not resolve a record older than the age cap", () => {
    const now = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(now);
    const store = makeStore();
    store.register("SKU1", { queryId: "q1" });

    nowSpy.mockReturnValue(now + 25 * 60 * 60 * 1000);
    expect(store.get("SKU1")).toBeUndefined();
  });

  it("self-heals a corrupt stored value", () => {
    sessionStorage.setItem("_ubi_attribution_", "{not json");
    const store = makeStore();

    expect(store.get("SKU1")).toBeUndefined();
    expect(logger.error).toHaveBeenCalled();

    store.register("SKU1", { queryId: "q1" });
    expect(store.get("SKU1")).toEqual({ queryId: "q1" });
  });

  it("treats a stored non-object as empty", () => {
    sessionStorage.setItem("_ubi_attribution_", "null");
    localStorage.setItem("_ubi_attribution_", "42");
    const store = makeStore();

    expect(store.get("SKU1")).toBeUndefined();

    store.register("SKU1", { queryId: "q1" });
    expect(store.get("SKU1")).toEqual({ queryId: "q1" });
  });

  it("caps the number of stored entries, dropping the oldest", () => {
    const base = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now");
    const store = makeStore();

    for (let i = 0; i < 51; i++) {
      nowSpy.mockReturnValue(base + i * 1000);
      store.register(`SKU${i}`, { queryId: `q${i}` });
    }

    nowSpy.mockReturnValue(base + 60_000);
    expect(store.get("SKU0")).toBeUndefined(); // evicted as the oldest
    expect(store.get("SKU1")).toEqual({ queryId: "q1" }); // only the oldest went
    expect(store.get("SKU2")).toEqual({ queryId: "q2" });
    expect(store.get("SKU50")).toEqual({ queryId: "q50" });
  });

  it("re-registering an existing object at the cap evicts nothing", () => {
    const base = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now");
    const store = makeStore();

    for (let i = 0; i < 50; i++) {
      nowSpy.mockReturnValue(base + i * 1000);
      store.register(`SKU${i}`, { queryId: `q${i}` });
    }

    // A second click on an already-recorded product must not push out SKU0.
    nowSpy.mockReturnValue(base + 60_000);
    store.register("SKU49", { queryId: "q49b" });

    expect(store.get("SKU0")).toEqual({ queryId: "q0" });
    expect(store.get("SKU49")).toEqual({ queryId: "q49b" });
  });

  it("logs and continues when the storage write fails", () => {
    jest.spyOn(sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const store = makeStore();

    expect(() => store.register("SKU1", { queryId: "q1" })).not.toThrow();
    expect(logger.error).toHaveBeenCalled();

    // The localStorage copy still landed, so resolution still works.
    expect(store.get("SKU1")).toEqual({ queryId: "q1" });
  });
});
