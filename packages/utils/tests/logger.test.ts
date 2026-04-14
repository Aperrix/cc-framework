import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import {
  createLogger,
  setLogLevel,
  getLogLevel,
  setLogWriter,
  resetLogWriter,
  type LogLevel,
  type LogContext,
} from "../src/logger.ts";

describe("createLogger", () => {
  const captured: Array<{ level: LogLevel; module: string; ctx: LogContext; msg: string }> = [];

  beforeEach(() => {
    captured.length = 0;
    setLogWriter((level, module, ctx, msg) => {
      captured.push({ level, module, ctx, msg });
    });
    setLogLevel("debug");
  });

  afterEach(() => {
    resetLogWriter();
    setLogLevel("info");
  });

  it("creates a logger with module name", () => {
    const log = createLogger("executor");
    log.info("started");
    expect(captured).toHaveLength(1);
    expect(captured[0].module).toBe("executor");
    expect(captured[0].msg).toBe("started");
    expect(captured[0].level).toBe("info");
  });

  it("supports structured context", () => {
    const log = createLogger("store");
    log.info({ runId: "abc-123", nodeId: "step1" }, "node_complete");
    expect(captured[0].ctx).toEqual({ runId: "abc-123", nodeId: "step1" });
    expect(captured[0].msg).toBe("node_complete");
  });

  it("filters by log level", () => {
    setLogLevel("warn");
    const log = createLogger("test");
    log.debug("ignored");
    log.info("ignored");
    log.warn("captured");
    log.error("captured");
    expect(captured).toHaveLength(2);
    expect(captured[0].level).toBe("warn");
    expect(captured[1].level).toBe("error");
  });

  it("silent level suppresses all output", () => {
    setLogLevel("silent");
    const log = createLogger("test");
    log.error("suppressed");
    expect(captured).toHaveLength(0);
  });

  it("child logger inherits bindings", () => {
    const log = createLogger("executor");
    const child = log.child({ runId: "run-1" });
    child.info({ nodeId: "step1" }, "executing");
    expect(captured[0].ctx).toEqual({ runId: "run-1", nodeId: "step1" });
  });

  it("child logger does not mutate parent", () => {
    const log = createLogger("executor");
    log.child({ runId: "run-1" });
    log.info("parent");
    expect(captured[0].ctx).toEqual({});
  });

  it("nested child loggers merge bindings", () => {
    const log = createLogger("executor");
    const child = log.child({ runId: "run-1" }).child({ nodeId: "step1" });
    child.info("deep");
    expect(captured[0].ctx).toEqual({ runId: "run-1", nodeId: "step1" });
  });

  it("setLogLevel and getLogLevel work together", () => {
    setLogLevel("error");
    expect(getLogLevel()).toBe("error");
    setLogLevel("debug");
    expect(getLogLevel()).toBe("debug");
  });

  it("all four levels emit correctly", () => {
    const log = createLogger("test");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(captured.map((c) => c.level)).toEqual(["debug", "info", "warn", "error"]);
  });
});
