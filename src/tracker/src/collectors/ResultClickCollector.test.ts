import type { Dispatcher } from "../dispatcher";
import { ResultClickCollector } from "./ResultClickCollector";

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

describe("ResultClickCollector", () => {
  let detach: (() => void) | undefined;

  afterEach(() => {
    detach?.();
    detach = undefined;
    document.body.innerHTML = "";
  });

  function attach(
    options: ConstructorParameters<typeof ResultClickCollector>[0],
  ) {
    const emit = jest.fn();
    const { dispatcher, logger } = makeDispatcher();
    const collector = new ResultClickCollector(options, emit);
    detach = collector.attach(dispatcher);
    return { emit, logger };
  }

  it("emits resolved data for a click on a matching element (default resolve)", () => {
    document.body.innerHTML =
      '<div data-query-id="q1" data-query="shoes">' +
      '<a data-object-id="p1" data-ordinal="3" data-object-id-field="sku">hit</a>' +
      "</div>";
    const { emit } = attach({ selector: "[data-object-id]" });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toEqual({
      objectId: "p1",
      ordinal: 3,
      objectIdField: "sku",
      actionName: "click",
      queryId: "q1",
      query: "shoes",
    });
  });

  it("resolves the result via closest() when a descendant is clicked", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a data-object-id="p1" data-ordinal="1"><span>text</span></a>' +
      "</div>";
    const { emit } = attach({ selector: "[data-object-id]" });

    (document.querySelector("span") as HTMLElement).click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0].objectId).toBe("p1");
  });

  it("emits nothing for clicks outside matching elements", () => {
    document.body.innerHTML =
      '<div data-query-id="q1"><a data-object-id="p1" data-ordinal="1">x</a></div>' +
      "<button id='other'>other</button>";
    const { emit, logger } = attach({ selector: "[data-object-id]" });

    (document.getElementById("other") as HTMLElement).click();

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("ignore suppresses clicks on nested interactive elements", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a data-object-id="p1" data-ordinal="1">' +
      "<span>title</span>" +
      '<button data-add-to-cart="">add</button>' +
      "</a></div>";
    const { emit } = attach({
      selector: "[data-object-id]",
      ignore: "[data-add-to-cart]",
    });

    (document.querySelector("[data-add-to-cart]") as HTMLElement).click();
    expect(emit).not.toHaveBeenCalled();

    (document.querySelector("span") as HTMLElement).click();
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("routes a data-action-name click without requiring a queryId", () => {
    // A conversion binding (e.g. add-to-cart on a product page) has no
    // data-query-id ancestor; attribution resolves later in the tracker.
    document.body.innerHTML =
      '<button data-object-id="p1" data-action-name="add_to_cart">add</button>';
    const { emit, logger } = attach({ selector: "[data-object-id]" });

    (document.querySelector("button") as HTMLElement).click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        objectId: "p1",
        actionName: "add_to_cart",
        queryId: undefined,
        ordinal: undefined,
      }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("skips and warns once when a plain click cannot be resolved", () => {
    // No data-ordinal, so a joinable click cannot be built. No `|| 0`.
    document.body.innerHTML =
      '<div data-query-id="q1"><a data-object-id="p1">x</a></div>';
    const { emit, logger } = attach({ selector: "[data-object-id]" });

    (document.querySelector("a") as HTMLElement).click();
    (document.querySelector("a") as HTMLElement).click();

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("skips and warns when data-query-id is missing for a plain click", () => {
    document.body.innerHTML = '<a data-object-id="p1" data-ordinal="1">x</a>';
    const { emit, logger } = attach({ selector: "[data-object-id]" });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("an empty or non-positive-integer data-ordinal is skipped, never sent as 0", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a id="e1" data-object-id="p1" data-ordinal="">x</a>' +
      '<a id="e2" data-object-id="p2" data-ordinal="0">y</a>' +
      '<a id="e3" data-object-id="p3" data-ordinal="2.5">z</a>' +
      "</div>";
    const { emit, logger } = attach({ selector: "[data-object-id]" });

    (document.getElementById("e1") as HTMLElement).click();
    (document.getElementById("e2") as HTMLElement).click();
    (document.getElementById("e3") as HTMLElement).click();

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("an ignore selector matching the result element itself does not silence it", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a class="hit" data-object-id="p1" data-ordinal="1">x</a>' +
      "</div>";
    const { emit } = attach({ selector: "[data-object-id]", ignore: ".hit" });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("warns once and skips when the selector matches the page body", () => {
    const { emit, logger } = attach({ selector: "body" });

    document.body.click();
    document.body.click();

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("a custom resolve may deliberately target the body", () => {
    const { emit } = attach({
      selector: "body",
      resolve: () => ({ objectId: "page", ordinal: 1, queryId: "qc" }),
    });

    document.body.click();

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("data-event-* attributes ride along as custom event attributes", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a data-object-id="p1" data-ordinal="1" data-event-badge="sale"' +
      ' data-event-sale_price="9.99" data-event-promo-code="X"' +
      ' data-testid="junk">x</a>' +
      "</div>";
    const { emit } = attach({ selector: "[data-object-id]" });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit).toHaveBeenCalledTimes(1);
    const resolved = emit.mock.calls[0][0];
    expect(resolved.badge).toBe("sale");
    expect(resolved.sale_price).toBe("9.99");
    expect(resolved.promoCode).toBe("X");
    expect(resolved.testid).toBeUndefined();
  });

  it("data-event values that look like JSON objects or arrays are parsed", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      "<a data-object-id='p1' data-ordinal='1'" +
      ' data-event-filters=\'{"brand":"acme","in_stock":true}\'' +
      ' data-event-tags=\'["a","b"]\'' +
      " data-event-count='3' data-event-badge='sale'>x</a>" +
      "</div>";
    const { emit } = attach({ selector: "[data-object-id]" });

    (document.querySelector("a") as HTMLElement).click();

    const resolved = emit.mock.calls[0][0];
    expect(resolved.filters).toEqual({ brand: "acme", in_stock: true });
    expect(resolved.tags).toEqual(["a", "b"]);
    expect(resolved.count).toBe("3"); // scalars are never parsed
    expect(resolved.badge).toBe("sale");
  });

  it("a malformed JSON-looking value stays a string and warns once", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      "<a data-object-id='p1' data-ordinal='1'" +
      " data-event-flags='{on_sale:true}' data-event-size='[2-pack]'>x</a>" +
      "</div>";
    const { emit, logger } = attach({ selector: "[data-object-id]" });

    (document.querySelector("a") as HTMLElement).click();
    (document.querySelector("a") as HTMLElement).click();

    expect(emit).toHaveBeenCalledTimes(2);
    const resolved = emit.mock.calls[0][0];
    expect(resolved.flags).toBe("{on_sale:true}");
    expect(resolved.size).toBe("[2-pack]");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("extra keys from a custom resolve flow through", () => {
    document.body.innerHTML = "<a class='hit'>x</a>";
    const { emit } = attach({
      selector: ".hit",
      resolve: () => ({ objectId: "c", ordinal: 1, queryId: "qc", badge: "x" }),
    });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit.mock.calls[0][0].badge).toBe("x");
  });

  it("uses a custom resolve when provided", () => {
    document.body.innerHTML = "<a class='hit'>x</a>";
    const { emit } = attach({
      selector: ".hit",
      resolve: () => ({ objectId: "custom", ordinal: 9, queryId: "qc" }),
    });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toEqual({
      objectId: "custom",
      ordinal: 9,
      queryId: "qc",
      actionName: "click",
    });
  });

  it("skips silently when a custom resolve returns undefined", () => {
    document.body.innerHTML = "<a class='hit'>x</a>";
    const { emit, logger } = attach({
      selector: ".hit",
      resolve: () => undefined,
    });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("still collects when a descendant stops propagation during bubbling", () => {
    document.body.innerHTML =
      '<div data-query-id="q1">' +
      '<a data-object-id="p1" data-ordinal="1"><button id="inner">b</button></a>' +
      "</div>";
    const inner = document.getElementById("inner") as HTMLElement;
    inner.addEventListener("click", (e) => e.stopPropagation());
    const { emit } = attach({ selector: "[data-object-id]" });

    inner.click();

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("covers elements added after attach (delegation)", () => {
    document.body.innerHTML = '<div id="grid" data-query-id="q1"></div>';
    const { emit } = attach({ selector: "[data-object-id]" });

    const late = document.createElement("a");
    late.dataset.objectId = "late";
    late.dataset.ordinal = "5";
    (document.getElementById("grid") as HTMLElement).appendChild(late);
    late.click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0].objectId).toBe("late");
  });

  it("stops collecting after detach", () => {
    document.body.innerHTML =
      '<div data-query-id="q1"><a data-object-id="p1" data-ordinal="1">x</a></div>';
    const { emit } = attach({ selector: "[data-object-id]" });

    detach?.();
    detach = undefined;
    (document.querySelector("a") as HTMLElement).click();

    expect(emit).not.toHaveBeenCalled();
  });

  it("routes resolver errors to the dispatcher logger", () => {
    document.body.innerHTML = "<a class='hit'>x</a>";
    const { emit, logger } = attach({
      selector: ".hit",
      resolve: () => {
        throw new Error("boom");
      },
    });

    (document.querySelector("a") as HTMLElement).click();

    expect(emit).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
