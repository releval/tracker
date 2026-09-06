export type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  clear: () => void;
  flush: () => void;
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait = 100,
  immediate = false,
): DebouncedFunction<T> => {
  let timeout: NodeJS.Timeout | null = null;
  let args: Parameters<T> | null = null;
  let context: any = null;
  let result: ReturnType<T> | undefined;

  const later = () => {
    timeout = null;
    if (args) {
      result = func.apply(context, args);
      context = args = null;
    }
  };

  const debounced = function (this: any, ...callArgs: Parameters<T>) {
    context = this;
    args = callArgs;
    const callNow = immediate && !timeout;
    if (timeout) {
      clearTimeout(timeout);
    }

    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    } else {
      timeout = setTimeout(later, wait);
    }

    return result;
  } as DebouncedFunction<T>;

  debounced.clear = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  debounced.flush = () => {
    if (timeout) {
      result = func.apply(context, args as Parameters<T>);
      context = args = null;

      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
};

/**
 * Callback invoked by a MutationObserver when a matching element is added to or removed
 * from the DOM. Used internally by collectors to attach/detach event listeners as elements
 * appear and disappear.
 */
export type Handler<T extends Element> = (element: T) => void;

/**
 * Creates a MutationObserver that invokes `addHandler`/`removeHandler` for every element
 * matching `selector` that is added to or removed from the DOM - including matches nested
 * inside an added/removed subtree. When a container is inserted or removed as a unit, only
 * its root appears in the mutation record, so its descendants must be scanned too (otherwise
 * results rendered as a subtree would be missed and subtree removals would leak listeners).
 */
export const createMutationObserver = <T extends Element>(
  selector: string,
  addHandler: Handler<T>,
  removeHandler: Handler<T>,
): MutationObserver => {
  const forEachMatch = (node: Node, handler: Handler<T>) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.matches(selector)) {
      handler(element as T);
    }
    for (const descendant of element.querySelectorAll(selector)) {
      handler(descendant as T);
    }
  };

  return new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      mutation.addedNodes.forEach((node) => {
        forEachMatch(node, addHandler);
      });
      mutation.removedNodes.forEach((node) => {
        forEachMatch(node, removeHandler);
      });
    }
  });
};

/**
 * A valid UBI rank: a positive integer (1-based, absolute across pages:
 * `(page - 1) * pageSize + positionOnPage`). Anything else - 0, negative,
 * fractional, NaN - is not a rank and must never be sent: a fabricated
 * ordinal is indistinguishable from data downstream.
 */
export const isValidOrdinal = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;
