import { describe, expect, it, afterEach } from "vite-plus/test";
import { createDatabase, type Database } from "../../src/store/database.ts";

describe("createDatabase", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it("creates an in-memory database with all tables", () => {
    db = createDatabase(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("workflows");
    expect(names).toContain("runs");
    expect(names).toContain("node_executions");
    expect(names).toContain("outputs");
    expect(names).toContain("events");
    expect(names).toContain("artifacts");
    expect(names).toContain("isolation_environments");
  });
});
