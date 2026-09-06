import { BatchSink } from "./BatchSink";

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

describe("BatchSink persisted retry queue bounds", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("caps the persisted queue at the newest batches", () => {
    const storage = makeStorage();
    const sink = new BatchSink({
      endpointHost: "https://api.example.com",
      storage,
    });

    for (let i = 0; i < 12; i++) {
      (sink as any).persistForRetry([{ action_name: `a${i}` }], 0);
    }

    const stored = JSON.parse(
      storage.getItem("_ubi_batch_retry_https-api-example-com_") as string,
    );
    expect(stored).toHaveLength(10);
    expect(stored[0].events[0].action_name).toBe("a2");
    expect(stored[9].events[0].action_name).toBe("a11");
    sink.dispose();
  });

  it("drops persisted batches older than a day on load", () => {
    const storage = makeStorage();
    storage.setItem(
      "_ubi_batch_retry_https-api-example-com_",
      JSON.stringify([
        {
          events: [{ action_name: "old" }],
          attempt: 0,
          ts: Date.now() - 25 * 60 * 60 * 1000,
        },
        {
          events: [{ action_name: "fresh" }],
          attempt: 0,
          ts: Date.now() - 1000,
        },
      ]),
    );

    const sink = new BatchSink({
      endpointHost: "https://api.example.com",
      storage,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0].action_name).toBe("fresh");
    sink.dispose();
  });

  it("discards a corrupt persisted queue instead of throwing", () => {
    const storage = makeStorage();
    storage.setItem(
      "_ubi_batch_retry_https-api-example-com_",
      '{"not":"an array"}',
    );

    expect(() => {
      const sink = new BatchSink({
        endpointHost: "https://api.example.com",
        storage,
      });
      sink.dispose();
    }).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
