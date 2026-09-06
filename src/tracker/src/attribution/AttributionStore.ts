import type { Logger } from "../logging";

/**
 * The search context recorded for a result when it was clicked, used to
 * attribute later conversion events (add_to_cart, purchase) for the same
 * object back to the originating query.
 */
export type AttributionRecord = {
  /** The server-issued query id of the search that produced the result. */
  queryId: string;
  /** The absolute 1-based rank the result was clicked at, if recorded. */
  ordinal?: number;
  /** The query text as the user entered it, if recorded. */
  query?: string;
};

type StoredRecord = AttributionRecord & {
  /** The session the record was registered in; resolution is scoped to it. */
  sessionId: string;
  /** Registration time (epoch ms), for the age sweep. */
  ts: number;
};

type StoredMap = Record<string, StoredRecord>;

const STORAGE_KEY = "_ubi_attribution_";

// A record can never outlive the session that wrote it (the sessionId check
// below enforces that), so this age cap only guards against clock skew and
// entries orphaned by a session id that was cleared from storage. It matches
// the session's maximum duration.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Bounds the on-device footprint. Fifty distinct clicked results per session
// is far beyond any real shopping journey; beyond it the oldest records go.
const MAX_ENTRIES = 50;

export type AttributionStoreOptions = {
  localStorage: Storage;
  sessionStorage: Storage;
  /** Resolves the current session id, so records can be scoped to it. */
  sessionId: () => string;
  /** Resolves the current logger for storage diagnostics. */
  logger?: () => Logger | undefined;
};

/**
 * Object-keyed attribution store: `objectId -> { queryId, ordinal, query }`.
 *
 * Written by `Tracker.trackResultClick` and read by `Tracker.trackResultEvent`
 * (and `getResultAttribution`), so a conversion on a later page - including
 * after a full document navigation - resolves the query that produced the
 * clicked result without the integrator threading `query_id` by hand.
 *
 * Records go to BOTH sessionStorage and localStorage: sessionStorage covers
 * same-tab navigation, and the localStorage copy covers a result opened in a
 * new tab (which does not inherit sessionStorage). Resolution is scoped to the
 * session that registered the record, so the shared localStorage copy can
 * never re-attribute a later visit in a different session.
 *
 * The store performs no storage IO at construction; it reads on `get` and
 * writes on `register` only.
 */
export class AttributionStore {
  private readonly options: AttributionStoreOptions;

  constructor(options: AttributionStoreOptions) {
    this.options = options;
  }

  /** Records the attribution for a clicked result. */
  register(objectId: string, record: AttributionRecord): void {
    const stored: StoredRecord = {
      queryId: record.queryId,
      ordinal: record.ordinal,
      query: record.query,
      sessionId: this.options.sessionId(),
      ts: Date.now(),
    };

    for (const storage of [
      this.options.sessionStorage,
      this.options.localStorage,
    ]) {
      const map = this.pruneStale(this.load(storage));
      if (!(objectId in map)) {
        // Only a NEW object needs room: re-clicking an already-recorded
        // result at the cap must not evict an innocent oldest entry.
        this.enforceCap(map);
      }
      map[objectId] = stored;
      this.save(storage, map);
    }
  }

  /**
   * Returns the attribution recorded for an object in the current session, or
   * undefined. Stale entries (other session, over age) are pruned on read.
   */
  get(objectId: string): AttributionRecord | undefined {
    for (const storage of [
      this.options.sessionStorage,
      this.options.localStorage,
    ]) {
      const map = this.load(storage);
      const stored = map[objectId];
      if (!stored) continue;

      if (this.isStale(stored)) {
        delete map[objectId];
        this.save(storage, map);
        continue;
      }

      const record: AttributionRecord = { queryId: stored.queryId };
      if (stored.ordinal !== undefined) record.ordinal = stored.ordinal;
      if (stored.query !== undefined) record.query = stored.query;
      return record;
    }
    return undefined;
  }

  private isStale(stored: StoredRecord): boolean {
    return (
      typeof stored.queryId !== "string" ||
      stored.sessionId !== this.options.sessionId() ||
      Date.now() - stored.ts > MAX_AGE_MS
    );
  }

  /** Drops stale entries (other session, over age, malformed). */
  private pruneStale(map: StoredMap): StoredMap {
    for (const key of Object.keys(map)) {
      if (typeof map[key]?.ts !== "number" || this.isStale(map[key])) {
        delete map[key];
      }
    }
    return map;
  }

  /** Makes room for one new entry, evicting the oldest beyond the cap. */
  private enforceCap(map: StoredMap): void {
    const keys = Object.keys(map);
    if (keys.length >= MAX_ENTRIES) {
      keys
        .sort((a, b) => map[a].ts - map[b].ts)
        .slice(0, keys.length - MAX_ENTRIES + 1)
        .forEach((key) => {
          delete map[key];
        });
    }
  }

  private load(storage: Storage): StoredMap {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) {
        // A corrupt value would otherwise break attribution on every read;
        // drop it so the store self-heals.
        storage.removeItem(STORAGE_KEY);
        return {};
      }
      return parsed as StoredMap;
    } catch (e) {
      this.logError("Error reading the attribution store: ", e);
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // Removal is best-effort; a read-only storage keeps the corrupt value
        // and every load keeps returning the empty map.
      }
      return {};
    }
  }

  private save(storage: Storage, map: StoredMap): void {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      // Quota errors must never escape into the caller's click handler.
      this.logError("Error writing the attribution store: ", e);
    }
  }

  private logError(message: string, e: unknown): void {
    this.options.logger?.()?.error(message, e);
  }
}
