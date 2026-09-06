import { render } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { Tracker } from "../tracker";
import { SearchResults, useSearchResults } from "./SearchResults";
import { TrackerProvider } from "./TrackerProvider";
import { useResultImpression } from "./useResultImpression";

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

  static intersectEverywhere(el: Element) {
    for (const instance of MockIntersectionObserver.instances) {
      if (instance.observed.has(el)) {
        instance.callback([{ isIntersecting: true, target: el }], instance);
      }
    }
  }
}

function Card(props: {
  objectId: string;
  ordinal: number;
  disabled?: boolean;
}) {
  const ref = useResultImpression(
    { objectId: props.objectId, ordinal: props.ordinal },
    { disabled: props.disabled },
  );
  return createElement("div", { ref, "data-testid": "card" });
}

function harness(children: unknown, events: any[]) {
  const tracker = new Tracker({ application: "test" });
  tracker.addSink({ emit: (e) => events.push(e) });
  return createElement(TrackerProvider, { tracker }, children as any);
}

describe("useResultImpression", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    (globalThis as any).IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    (globalThis as any).IntersectionObserver = undefined;
  });

  it("reports one canonical impression when the element becomes visible", () => {
    const events: any[] = [];
    const { getByTestId } = render(
      harness(
        createElement(
          SearchResults,
          { queryId: "q1", query: "shoes" },
          createElement(Card, { objectId: "p1", ordinal: 3 }),
        ),
        events,
      ),
    );

    const card = getByTestId("card");
    MockIntersectionObserver.intersectEverywhere(card);
    MockIntersectionObserver.intersectEverywhere(card);

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.action_name).toBe("impression");
    expect(event.query_id).toBe("q1");
    expect(event.user_query).toBe("shoes");
    expect(event.event_attributes.object.object_id).toBe("p1");
    expect(event.event_attributes.position.ordinal).toBe(3);
  });

  it("extra keys on the result are persisted under event_attributes", () => {
    const events: any[] = [];
    function BadgedCard() {
      const ref = useResultImpression({
        objectId: "p9",
        ordinal: 1,
        badge: "sale",
      });
      return createElement("div", { ref, "data-testid": "badged" });
    }
    const { getByTestId } = render(
      harness(
        createElement(
          SearchResults,
          { queryId: "q1" },
          createElement(BadgedCard),
        ),
        events,
      ),
    );

    MockIntersectionObserver.intersectEverywhere(getByTestId("badged"));

    expect(events).toHaveLength(1);
    expect(events[0].event_attributes.badge).toBe("sale");
  });

  it("an inline extras object does not re-arm the observer", () => {
    const events: any[] = [];
    function InlineCard() {
      const ref = useResultImpression({
        objectId: "p10",
        ordinal: 1,
        badge: "sale",
      });
      return createElement("div", { ref, "data-testid": "inline" });
    }
    const { getByTestId, rerender } = render(
      harness(
        createElement(
          SearchResults,
          { queryId: "q1" },
          createElement(InlineCard),
        ),
        events,
      ),
    );
    const before = MockIntersectionObserver.instances.length;
    rerender(
      harness(
        createElement(
          SearchResults,
          { queryId: "q1" },
          createElement(InlineCard),
        ),
        events,
      ),
    );
    expect(MockIntersectionObserver.instances.length).toBe(before);

    MockIntersectionObserver.intersectEverywhere(getByTestId("inline"));
    expect(events).toHaveLength(1);
  });

  it("fires exactly once under StrictMode", () => {
    const events: any[] = [];
    const { getByTestId } = render(
      createElement(
        StrictMode,
        null,
        harness(
          createElement(
            SearchResults,
            { queryId: "q1" },
            createElement(Card, { objectId: "p1", ordinal: 1 }),
          ),
          events,
        ),
      ),
    );

    MockIntersectionObserver.intersectEverywhere(getByTestId("card"));

    expect(events).toHaveLength(1);
  });

  it("re-arms for a new queryId so consecutive searches are both counted", () => {
    const events: any[] = [];
    const tracker = new Tracker({ application: "test" });
    tracker.addSink({ emit: (e) => events.push(e) });

    const page = (queryId: string) =>
      createElement(
        TrackerProvider,
        { tracker },
        createElement(
          SearchResults,
          { queryId },
          createElement(Card, { objectId: "p1", ordinal: 1 }),
        ),
      );

    const { getByTestId, rerender } = render(page("q1"));
    MockIntersectionObserver.intersectEverywhere(getByTestId("card"));

    rerender(page("q2"));
    MockIntersectionObserver.intersectEverywhere(getByTestId("card"));

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.query_id)).toEqual(["q1", "q2"]);
  });

  it("no-ops without a SearchResults context", () => {
    const events: any[] = [];
    const { getByTestId } = render(
      harness(createElement(Card, { objectId: "p1", ordinal: 1 }), events),
    );

    MockIntersectionObserver.intersectEverywhere(getByTestId("card"));

    expect(events).toHaveLength(0);
    expect(
      MockIntersectionObserver.instances.every((i) => i.observed.size === 0),
    ).toBe(true);
  });

  it("no-ops when disabled", () => {
    const events: any[] = [];
    const { getByTestId } = render(
      harness(
        createElement(
          SearchResults,
          { queryId: "q1" },
          createElement(Card, { objectId: "p1", ordinal: 1, disabled: true }),
        ),
        events,
      ),
    );

    MockIntersectionObserver.intersectEverywhere(getByTestId("card"));

    expect(events).toHaveLength(0);
  });

  it("disconnects the observer on unmount", () => {
    const events: any[] = [];
    const { getByTestId, unmount } = render(
      harness(
        createElement(
          SearchResults,
          { queryId: "q1" },
          createElement(Card, { objectId: "p1", ordinal: 1 }),
        ),
        events,
      ),
    );
    const card = getByTestId("card");

    unmount();
    MockIntersectionObserver.intersectEverywhere(card);

    expect(events).toHaveLength(0);
  });
});

describe("SearchResults / useSearchResults", () => {
  it("exposes the current search to descendants and null outside", () => {
    let inside: unknown;
    let outside: unknown;
    const Inside = () => {
      inside = useSearchResults();
      return null;
    };
    const Outside = () => {
      outside = useSearchResults();
      return null;
    };

    render(
      createElement(
        "div",
        null,
        createElement(
          SearchResults,
          { queryId: "q1", query: "mice" },
          createElement(Inside),
        ),
        createElement(Outside),
      ),
    );

    expect(inside).toEqual({ queryId: "q1", query: "mice" });
    expect(outside).toBeNull();
  });
});
