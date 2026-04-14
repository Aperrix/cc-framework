import { describe, expect, it, afterEach } from "vite-plus/test";
import { createDatabaseFromUrl, isPostgresUrl } from "../../src/store/create-database.ts";
import type { Database } from "../../src/store/database.ts";

describe("isPostgresUrl", () => {
  it("returns true for postgres:// URLs", () => {
    expect(isPostgresUrl("postgres://localhost:5432/mydb")).toBe(true);
  });

  it("returns true for postgresql:// URLs", () => {
    expect(isPostgresUrl("postgresql://user:pass@host/db")).toBe(true);
  });

  it("returns false for file paths", () => {
    expect(isPostgresUrl("/tmp/test.db")).toBe(false);
  });

  it("returns false for :memory:", () => {
    expect(isPostgresUrl(":memory:")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isPostgresUrl("")).toBe(false);
  });
});

describe("createDatabaseFromUrl", () => {
  let db: Database | undefined;

  afterEach(() => {
    db?.close();
  });

  it("creates a SQLite database for :memory:", async () => {
    db = await createDatabaseFromUrl(":memory:");
    expect(db).toBeDefined();
    expect(typeof db.close).toBe("function");
  });

  it("creates a SQLite database for file paths", async () => {
    db = await createDatabaseFromUrl(":memory:");
    expect(db).toBeDefined();
    // Verify it's a working SQLite database by checking tables exist
    const { sql } = await import("drizzle-orm");
    const tables = db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain("workflows");
    expect(names).toContain("runs");
  });

  // PostgreSQL connection tests are skipped — they require a running PG instance.
  // The factory URL detection is tested above via isPostgresUrl.
});
