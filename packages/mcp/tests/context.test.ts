import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

// Container for the real createDatabase — must use var for hoisting compatibility
// with vi.mock factories (which are hoisted to the top of the file).
// eslint-disable-next-line no-var
var _realCreateDatabase: ((path: string) => unknown) | undefined;

vi.mock("@cc-framework/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cc-framework/core")>();
  return {
    ...actual,
    ensureGlobalHome: vi.fn().mockResolvedValue("/tmp/fake-home"),
    loadConfig: vi.fn().mockResolvedValue({
      model: "sonnet",
      effort: "high",
      isolation: { strategy: "branch", branch_prefix: "ccf/" },
      paths: {
        embeddedWorkflows: "",
        globalHome: "/tmp/fake-home",
        globalWorkflows: "/tmp/fake-home/workflows",
        database: ":memory:",
        projectRoot: "/tmp/test",
        projectConfig: "/tmp/test/.cc-framework",
        projectWorkflows: "/tmp/test/.cc-framework/workflows",
        projectPrompts: "/tmp/test/.cc-framework/prompts",
        projectScripts: "/tmp/test/.cc-framework/scripts",
        docsDir: "/tmp/test/docs",
      },
    }),
  };
});

vi.mock("@cc-framework/workflows", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cc-framework/workflows")>();
  _realCreateDatabase = actual.createDatabase;
  return {
    ...actual,
    createDatabase: vi.fn((...args: Parameters<typeof actual.createDatabase>) => {
      // During beforeEach we set sharedDb, then the mock returns it.
      // During initial module load (first call), we use the real implementation.
      if (sharedDb) return sharedDb;
      return actual.createDatabase(...args);
    }),
  };
});

import { createMcpContext, destroyMcpContext } from "../src/context.ts";
import { ensureGlobalHome, loadConfig } from "@cc-framework/core";
import { StoreQueries, type Database } from "@cc-framework/workflows";

let sharedDb: Database;

function makeDb(): Database {
  if (!_realCreateDatabase) throw new Error("realCreateDatabase not captured");
  return _realCreateDatabase(":memory:") as Database;
}

describe("createMcpContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedDb = makeDb();
  });

  it("returns context with all required fields", async () => {
    const ctx = await createMcpContext("/tmp/test");

    expect(ctx.config).toBeDefined();
    expect(ctx.config.model).toBe("sonnet");
    expect(ctx.db).toBe(sharedDb);
    expect(ctx.store).toBeInstanceOf(StoreQueries);
    expect(typeof ctx.sessionId).toBe("string");
    expect(ctx.cwd).toBe("/tmp/test");
  });

  it("calls ensureGlobalHome and loadConfig", async () => {
    await createMcpContext("/tmp/test");

    expect(ensureGlobalHome).toHaveBeenCalledOnce();
    expect(loadConfig).toHaveBeenCalledOnce();
  });

  it("creates a new session when none exists", async () => {
    const ctx = await createMcpContext("/tmp/test");

    const session = ctx.store.getActiveSession("/tmp/test");
    expect(session).toBeDefined();
    expect(session!.id).toBe(ctx.sessionId);
  });

  it("reuses existing session when one is active", async () => {
    // Create a session directly before createMcpContext runs
    const preStore = new StoreQueries(sharedDb);
    const existingId = preStore.createSession("/tmp/test");

    const ctx = await createMcpContext("/tmp/test");

    expect(ctx.sessionId).toBe(existingId);
  });
});

describe("destroyMcpContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedDb = makeDb();
  });

  it("closes session and database", async () => {
    const ctx = await createMcpContext("/tmp/test");

    const closeSpy = vi.spyOn(ctx.store, "closeSession");
    const dbCloseSpy = vi.spyOn(ctx.db, "close");

    destroyMcpContext(ctx);

    expect(closeSpy).toHaveBeenCalledWith(ctx.sessionId);
    expect(dbCloseSpy).toHaveBeenCalledOnce();
  });
});
