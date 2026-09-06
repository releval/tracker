import { render } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { Tracker } from "../tracker";
import { TrackerProvider, useTracker } from "./TrackerProvider";

describe("TrackerProvider", () => {
  it("starts the tracker on mount and stops it on unmount", () => {
    const tracker = new Tracker({ application: "test" });
    const start = jest.spyOn(tracker, "start");
    const stop = jest.spyOn(tracker, "stop");

    const { unmount } = render(
      createElement(TrackerProvider, { tracker }, null),
    );

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("does not start when autoStart is false", () => {
    const tracker = new Tracker({ application: "test" });
    const start = jest.spyOn(tracker, "start");

    render(createElement(TrackerProvider, { tracker, autoStart: false }, null));

    expect(start).not.toHaveBeenCalled();
  });

  it("runs onInit exactly once and ends started under StrictMode", () => {
    const tracker = new Tracker({ application: "test" });
    const start = jest.spyOn(tracker, "start");
    const stop = jest.spyOn(tracker, "stop");
    const onInit = jest.fn();

    render(
      createElement(
        StrictMode,
        null,
        createElement(TrackerProvider, { tracker, onInit }, null),
      ),
    );

    // StrictMode double-invokes: mount -> cleanup -> mount. onInit is guarded to
    // run once; start()/stop() are restart-safe, so the net effect is started.
    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onInit).toHaveBeenCalledWith(tracker);
    expect(start.mock.calls.length - stop.mock.calls.length).toBe(1);
  });

  it("constructs a tracker from options when no instance is passed", () => {
    let seen: Tracker | undefined;
    const Consumer = () => {
      seen = useTracker();
      return null;
    };

    render(
      createElement(
        TrackerProvider,
        { options: { application: "from-options" } },
        createElement(Consumer),
      ),
    );

    expect(seen).toBeInstanceOf(Tracker);
  });

  it("useTracker returns the provided instance", () => {
    const tracker = new Tracker({ application: "test" });
    let seen: Tracker | undefined;
    const Consumer = () => {
      seen = useTracker();
      return null;
    };

    render(
      createElement(TrackerProvider, { tracker }, createElement(Consumer)),
    );

    expect(seen).toBe(tracker);
  });

  it("useTracker throws when used outside a provider", () => {
    const Orphan = () => {
      useTracker();
      return null;
    };
    // React logs the render error to console.error; silence the expected noise.
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(createElement(Orphan))).toThrow(
      /must be used within a <TrackerProvider>/,
    );

    errorSpy.mockRestore();
  });
});
