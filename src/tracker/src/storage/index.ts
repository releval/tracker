import { MemoryStorage } from "./MemoryStorage";

export * from "./ClientId";
export * from "./MemoryStorage";
export * from "./SessionManager";

function tryGetStorage(
  storageName: "localStorage" | "sessionStorage",
): Storage | undefined {
  // Guard the bare `window` reference so construction does not throw under SSR.
  if (typeof window === "undefined") {
    return undefined;
  }
  // EVERYTHING below stays inside the try: the `window.localStorage` accessor
  // ITSELF throws SecurityError when access is denied (sandboxed iframes,
  // browsers with site data blocked) - not just the setItem call. An
  // embeddable tracker must never let that reach the customer's page script.
  try {
    if (!(storageName in window)) {
      return undefined;
    }
    const storage = window[storageName] as Storage;
    if (!storage) {
      return undefined;
    }
    const uid = `_ubi_probe_${Date.now()}`;
    storage.setItem(uid, uid);
    const result = storage.getItem(uid) === uid;
    storage.removeItem(uid);
    return result ? storage : undefined;
  } catch (_exception) {
    return undefined;
  }
}

// With no usable Web Storage (blocked by the user, or no DOM at all under
// SSR), fall back to in-memory storage so nothing throws. Identity then lives
// only as long as the page. The previous cookie fallback serialised every key
// (session, retry queue, attribution) into a single cookie sent on every
// request to the customer's origin and silently failed past ~4 KB - strictly
// worse than not persisting.
export const initLocalStorage = (): Storage =>
  tryGetStorage("localStorage") ?? new MemoryStorage();

export const initSessionStorage = (): Storage =>
  tryGetStorage("sessionStorage") ?? new MemoryStorage();
