/**
 * An in-memory {@link Storage} implementation used when no real Web Storage is
 * available - most importantly under server-side rendering (no `window`), where
 * touching `localStorage`/`document.cookie` would throw. It provides page-scoped
 * state with no cross-page persistence, so the tracker constructs and runs
 * inertly on the server and starts persisting once it hydrates in the browser.
 */
export class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}
