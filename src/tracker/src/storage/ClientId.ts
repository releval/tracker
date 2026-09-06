import { ulid } from "ulidx";
import type { Logger } from "../logging";

const CLIENT_ID_KEY = "_ubi_client_id_";

/**
 * Gets or creates a stable anonymous client ID persisted in localStorage.
 * This ID survives across sessions and is used to identify the device/browser.
 * A failing storage read or write is logged and a freshly generated id is
 * still returned, so tracking continues (per page) without persistence.
 */
export function getOrCreateClientId(storage: Storage, logger?: Logger): string {
  let clientId: string | null = null;
  try {
    clientId = storage.getItem(CLIENT_ID_KEY);
  } catch (e) {
    logger?.error("Error reading the client id: ", e);
  }
  if (!clientId) {
    clientId = ulid();
    try {
      storage.setItem(CLIENT_ID_KEY, clientId);
    } catch (e) {
      logger?.error("Error persisting the client id: ", e);
    }
  }
  return clientId;
}
