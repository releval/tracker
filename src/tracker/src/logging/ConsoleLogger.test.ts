import { ConsoleLogger } from "./ConsoleLogger";

describe("ConsoleLogger", () => {
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, "debug").mockImplementation();
    infoSpy = jest.spyOn(console, "info").mockImplementation();
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
    errorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("always emits warn and error", () => {
    const log = new ConsoleLogger();
    log.warn("w", 1);
    log.error("e", 2);
    expect(warnSpy).toHaveBeenCalledWith("w", 1);
    expect(errorSpy).toHaveBeenCalledWith("e", 2);
  });

  it("suppresses debug and info by default", () => {
    const log = new ConsoleLogger();
    log.debug("d");
    log.info("i");
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("emits debug and info when verbose", () => {
    const log = new ConsoleLogger({ verbose: true });
    log.debug("d", 1);
    log.info("i", 2);
    expect(debugSpy).toHaveBeenCalledWith("d", 1);
    expect(infoSpy).toHaveBeenCalledWith("i", 2);
  });
});
