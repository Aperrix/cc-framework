import { describe, expect, it, afterEach } from "vite-plus/test";
import { createCliContext, destroyCliContext, type CliContext } from "../../src/shared/context.ts";
import { rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("createCliContext", () => {
  let ctx: CliContext | undefined;
  let tempDir: string;

  afterEach(async () => {
    if (ctx) {
      destroyCliContext(ctx);
      ctx = undefined;
    }
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("initializes config, database, store, and session", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-ctx-test-"));
    ctx = await createCliContext(tempDir);

    expect(ctx.config).toBeDefined();
    expect(ctx.db).toBeDefined();
    expect(ctx.store).toBeDefined();
    expect(ctx.sessionId).toBeDefined();
    expect(ctx.cwd).toBe(tempDir);
  });

  it("creates an active session for the project", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-ctx-test-"));
    ctx = await createCliContext(tempDir);

    const session = ctx.store.getSession(ctx.sessionId);
    expect(session).not.toBeNull();
    expect(session!.status).toBe("active");
  });

  it("resumes existing active session on second call", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-ctx-test-"));

    // First context creates a session — don't close DB yet, just destroy after
    const ctx1 = await createCliContext(tempDir);
    const sessionId1 = ctx1.sessionId;
    // Close the DB so we can open it again
    destroyCliContext(ctx1);

    // Second context opens the same DB file and should find the active session
    ctx = await createCliContext(tempDir);
    expect(ctx.sessionId).toBe(sessionId1);
  });

  it("config paths include the project root", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-ctx-test-"));
    ctx = await createCliContext(tempDir);

    expect(ctx.config.paths.projectRoot).toBe(tempDir);
  });
});

describe("destroyCliContext", () => {
  it("closes the database without throwing", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ccf-ctx-destroy-test-"));
    try {
      const ctx = await createCliContext(tempDir);
      expect(() => destroyCliContext(ctx)).not.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
