import type { Dispatcher } from "../dispatcher";
import { ResultImpressionCollector } from "./ResultImpressionCollector";

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly observed = new Set<Element>();

  constructor(
    private readonly callback: (
      entries: Array<
        Pick<IntersectionObserverEntry, "isIntersecting" | "target">
      >,
      observer: MockIntersectionObserver,
    ) => void,
  ) {
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.add(el);
  }

  unobserve(el: Element) {
    this.observed.delete(el);
  }

  disconnect() {
    this.observed.clear();
  }

  takeRecords() {
    return [];
  }

  /** Delivers an intersection for every OBSERVED element among those given. */
  intersect(...els: Element[]) {
    const entries = els
      .filter((el) => this.observed.has(el))
      .map((target) => ({ isIntersecting: true, target }));
    if (entries.length > 0) {
      this.callback(entries, this);
    }
  }
}

function makeDispatcher() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const dispatcher: Dispatcher = { logger, dispatch: jest.fn() };
  return { dispatcher, logger };
}

const flushMutations = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("ResultImpressionCollector", () => {
  let detach: (() => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    MockIntersectionObserver.instances = [];
    (globalThis as any).IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    detach?.();
    detach = undefined;
    jest.useRealTimers();
    (globalThis as any).IntersectionObserver = undefined;
    document.body.innerHTML = "";
  });

  function attach(
    options: ConstructorParameters<typeof ResultImpressionCollector>[0],
  ) {
    const emit = jest.fn();
    const { dispatcher, logger } = makeDispatcher();
    const collector = new ResultImpressionCollector(options, emit);
    detach = collector.attach(dispatcher);
    const io = MockIntersectionObserver.instances.at(-1)!;
    return { emit, logger, io };
  }

  it("emits one canonical impression per visible element, grouped per query", () => {
    document.body.innerHTML =
      '<div data-query-id="q1" data-query="shoes">' +
      '<a id="c1" data-object-id="p1" data-ordinal="1">a</a>' +
      '<a id="c2" data-object-id="p2" data-ordinal="2" data-object-id-field="sku">b</a>' +
      "</div>";
    const { emit, io } = attach({ selector: "[data-object-id]" });

    io.intersect(
      document.getElementById("c1") as Element,
      document.getElementById("c2") as Element,
    );
    jest.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(1);
    const [items, queryId, query] = emit.mock.calls[0];
    expect(queryId).toBe("q1");
    expect(query).toBe("shoes");
    expect(items).toEqual([
      { objectId: "p1", ordinal: 1 },
      { objectId: "p2", ordinal: 2, objectIdField: "sku" },
    ]);
  });

  it("fires once per element", () => {
    document.body.innerHTML =
      '<div data-query-id="q1"><a id="c1" data-object-id="p1" data-ordinal="1">a</a></div>';
    const { emit, io } = attach({ selector: "[data-object-id]" });
    const el = document.getElementById("c1") as Element;

    io.intersect(el);
    io.intersect(el); // unobserved after the first visibility
    jest.advanceTimersByTime(250);
    io.intersect(el);
    jest.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toHaveLength(1);
  });

  it("groups impressions from different queries into separate emits", () => {
    document.body.innerHTML =
      '<div data-query-id="q1"><a id="c1" data-object-id="p1" data-ordinal="1">a</a></div>' +
      '<div data-query-id="q2"><a id="c2" data-object-id="p2" data-ordinal="1">b</a></div>';
    const { emit, io } = attach({ selector: "[data-object-id]" });

    io.intersect(
      document.getElementById("c1") as Element,
      document.getElementById("c2") as Element,
    );
    jest.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(2);
    const queryIds = emit.mock.calls.map((c) => c[1]).sort();
    expect(queryIds).toEqual(["q1", "q2"]);
  });

  it("discovers elements added after attach", async () => {
    document.body.innerHTML = '<div id="grid" data-query-id="q1"></div>';
    const { emit, io } = attach({ selector: "[data-object-id]" });

    const late = document.createElement("a");
    late.dataset.objectId = "late";
    late.dataset.ordinal = "7";
    (document.getElementById("grid") as HTMLElement).appendChild(late);
    await flushMutations();

    io.intersect(late);
    jest.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toEqual([{ objectId: "late", ordinal: 7 }]);
  });

  it("skips and warns once when required data cannot be resolved", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a id="c1" data-object-id="p1">no ordinal</a>' +
      '<a id="c2" data-object-id="p2">no ordinal either</a>' +
      "</div>";
    const { emit, logger, io } = attach({ selector: "[data-object-id]" });

    io.intersect(document.getElementById("c1") as Element);
    io.intersect(document.getElementById("c2") as Element);
    jest.advanceTimersByTime(250);

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("skips silently when a custom resolve returns undefined", () => {
    document.body.innerHTML = '<a id="c1" class="hit">a</a>';
    const { emit, logger, io } = attach({
      selector: ".hit",
      resolve: () => undefined,
    });

    io.intersect(document.getElementById("c1") as Element);
    jest.advanceTimersByTime(250);

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not merge distinct queries whose ids and text concatenate equally", () => {
    document.body.innerHTML =
      '<div data-query-id="a" data-query="b c"><a id="c1" data-object-id="p1" data-ordinal="1">a</a></div>' +
      '<div data-query-id="a b" data-query="c"><a id="c2" data-object-id="p2" data-ordinal="1">b</a></div>';
    const { emit, io } = attach({ selector: "[data-object-id]" });

    io.intersect(
      document.getElementById("c1") as Element,
      document.getElementById("c2") as Element,
    );
    jest.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(2);
  });

  it("a non-positive-integer data-ordinal is skipped, never sent as 0", () => {
    document.body.innerHTML =
      '<div data-query-id="q1"><a id="c1" data-object-id="p1" data-ordinal="">a</a></div>';
    const { emit, logger, io } = attach({ selector: "[data-object-id]" });

    io.intersect(document.getElementById("c1") as Element);
    jest.advanceTimersByTime(250);

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("warns once and never observes a selector matching the page body", () => {
    const { emit, logger, io } = attach({ selector: "body" });

    jest.advanceTimersByTime(250);

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(io.observed.has(document.body)).toBe(false);
  });

  it("data-event-* attributes ride along on impression items", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a id="c1" data-object-id="p1" data-ordinal="1" data-event-badge="sale">a</a>' +
      "</div>";
    const { emit, io } = attach({ selector: "[data-object-id]" });

    io.intersect(document.getElementById("c1") as Element);
    jest.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({ objectId: "p1", ordinal: 1, badge: "sale" }),
    );
  });

  it("JSON-looking data-event values are parsed on impression items", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      "<a id='c1' data-object-id='p1' data-ordinal='1'" +
      ' data-event-tags=\'["new","sale"]\'>a</a>' +
      "</div>";
    const { emit, io } = attach({ selector: "[data-object-id]" });

    io.intersect(document.getElementById("c1") as Element);
    jest.advanceTimersByTime(250);

    expect(emit.mock.calls[0][0][0].tags).toEqual(["new", "sale"]);
  });

  it("uses a custom resolve when provided", () => {
    document.body.innerHTML = '<a id="c1" class="hit">a</a>';
    const { emit, io } = attach({
      selector: ".hit",
      resolve: () => ({ objectId: "custom", ordinal: 4, queryId: "qc" }),
    });

    io.intersect(document.getElementById("c1") as Element);
    jest.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]).toEqual([
      [{ objectId: "custom", ordinal: 4 }],
      "qc",
      undefined,
    ]);
  });

  it("drops pending impressions at detach instead of emitting them later", () => {
    document.body.innerHTML =
      '<div data-query-id="q1"><a id="c1" data-object-id="p1" data-ordinal="1">a</a></div>';
    const { emit, io } = attach({ selector: "[data-object-id]" });

    io.intersect(document.getElementById("c1") as Element);
    detach?.();
    detach = undefined;
    jest.advanceTimersByTime(1000);

    expect(emit).not.toHaveBeenCalled();
  });

  it("stops discovering elements after detach", async () => {
    document.body.innerHTML = '<div id="grid" data-query-id="q1"></div>';
    const { io } = attach({ selector: "[data-object-id]" });

    detach?.();
    detach = undefined;

    const late = document.createElement("a");
    late.dataset.objectId = "late";
    late.dataset.ordinal = "1";
    (document.getElementById("grid") as HTMLElement).appendChild(late);
    await flushMutations();

    expect(io.observed.has(late)).toBe(false);
  });
});
