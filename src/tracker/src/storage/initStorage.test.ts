import { Tracker } from "../tracker";
import { initLocalStorage, initSessionStorage, MemoryStorage } from "./index";

/**
 * Overrides a window storage accessor so that READING it throws - the way a
 * sandboxed iframe or a browser with site data blocked behaves - and returns
 * a restore function.
 */
function denyStorage(name: "localStorage" | "sessionStorage"): () => void {
  const original = Object.getOwnPropertyDescriptor(window, name);
  Object.defineProperty(window, name, {
    configurable: true,
    get() {
      throw new DOMException(
        "Access is denied for this document.",
        "SecurityError",
      );
    },
  });
  return () => {
    if (original) {
      Object.defineProperty(window, name, original);
    } else {
      delete (window as unknown as Record<string, unknown>)[name];
    }
  };
}

describe("storage initialization", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("falls back to memory when the storage ACCESSOR itself throws", () => {
    const restore = denyStorage("localStorage");
    try {
      const storage = initLocalStorage();
      expect(storage).toBeInstanceOf(MemoryStorage);
      expect(() => storage.setItem("k", "v")).not.toThrow();
      expect(storage.getItem("k")).toBe("v");
    } finally {
      restore();
    }
  });

  it("falls back to memory when the probe write throws (blocked/quota)", () => {
    const spy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const storage = initLocalStorage();
    spy.mockRestore();

    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  it("returns the real storage when it is usable", () => {
    expect(initLocalStorage()).toBe(window.localStorage);
    expect(initSessionStorage()).toBe(window.sessionStorage);
  });

  it("Tracker construction and use survive denied storage end to end", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const restoreLocal = denyStorage("localStorage");
    const restoreSession = denyStorage("sessionStorage");
    try {
      expect(() => {
        const tracker = new Tracker({ application: "denied" });
        tracker.start();
        tracker.trackSearch({ query: "q", queryId: "qid" });
        tracker.trackResultClick({ objectId: "o", ordinal: 1, queryId: "qid" });
        tracker.trackResultEvent({ actionName: "add_to_cart", objectId: "o" });
        expect(typeof tracker.sessionId).toBe("string");
        expect(typeof tracker.clientId).toBe("string");
        tracker.stop();
      }).not.toThrow();
    } finally {
      restoreSession();
      restoreLocal();
      logSpy.mockRestore();
    }
  });
});
