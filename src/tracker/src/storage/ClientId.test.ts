import { getOrCreateClientId } from "./ClientId";

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

describe("getOrCreateClientId", () => {
  it("generates a client ID on first call", () => {
    const storage = createMockStorage();
    const id = getOrCreateClientId(storage);

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(storage.setItem).toHaveBeenCalledWith("_ubi_client_id_", id);
  });

  it("returns the same ID on subsequent calls", () => {
    const storage = createMockStorage();
    const first = getOrCreateClientId(storage);
    const second = getOrCreateClientId(storage);

    expect(second).toBe(first);
  });

  it("persists across storage instances (simulates page reload)", () => {
    const storage = createMockStorage();
    const first = getOrCreateClientId(storage);

    // Simulate new page load reading same storage
    const second = getOrCreateClientId(storage);
    expect(second).toBe(first);
  });

  it("does not overwrite existing client ID", () => {
    const storage = createMockStorage();
    storage.setItem("_ubi_client_id_", "existing-id");

    const id = getOrCreateClientId(storage);
    expect(id).toBe("existing-id");
  });
});
