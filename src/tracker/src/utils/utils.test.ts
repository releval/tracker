import { createMutationObserver, debounce } from "./index";

describe("debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls function after wait period", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on subsequent calls", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    jest.advanceTimersByTime(50);
    debounced();
    jest.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments to the function", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("a", "b");
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("calls immediately when immediate=true", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100, true);

    debounced();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clear() cancels pending invocation", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.clear();
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("flush() invokes immediately and clears timer", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("createMutationObserver", () => {
  beforeEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns a MutationObserver instance", () => {
    const observer = createMutationObserver<HTMLElement>(
      ".result",
      () => {},
      () => {},
    );
    expect(observer).toBeInstanceOf(MutationObserver);
  });

  it("fires addHandler for matches nested inside an added subtree", async () => {
    const added: string[] = [];
    const observer = createMutationObserver<HTMLElement>(
      ".result",
      (el) => added.push(el.getAttribute("data-id") as string),
      () => {},
    );
    observer.observe(document.body, { childList: true, subtree: true });

    // A container subtree is inserted as one unit: only the container is in
    // addedNodes, so its matching descendants must be scanned.
    const container = document.createElement("div");
    container.innerHTML =
      '<ul><li class="result" data-id="a"></li><li class="result" data-id="b"></li></ul>';
    document.body.appendChild(container);

    await new Promise((r) => setTimeout(r, 0));
    observer.disconnect();

    expect(added.sort()).toEqual(["a", "b"]);
  });

  it("fires removeHandler for matches removed as part of a subtree", async () => {
    document.body.innerHTML =
      '<div id="wrap"><span class="result" data-id="x"></span></div>';
    const removed: string[] = [];
    const observer = createMutationObserver<HTMLElement>(
      ".result",
      () => {},
      (el) => removed.push(el.getAttribute("data-id") as string),
    );
    observer.observe(document.body, { childList: true, subtree: true });

    (document.getElementById("wrap") as HTMLElement).remove();

    await new Promise((r) => setTimeout(r, 0));
    observer.disconnect();

    expect(removed).toEqual(["x"]);
  });
});
