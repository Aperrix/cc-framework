/**
 * Database factory — creates either a SQLite or PostgreSQL database based on
 * the connection string format.
 *
 * - `postgres://` or `postgresql://` → PostgreSQL via node-postgres
 * - Anything else (file path or ":memory:") → SQLite via better-sqlite3
 */

import { createDatabase as createSqliteDatabase, type Database } from "./database.ts";

/** Returns true if the connection string targets a PostgreSQL database. */
export function isPostgresUrl(connectionString: string): boolean {
  return connectionString.startsWith("postgres://") || connectionString.startsWith("postgresql://");
}

/**
 * Create a database instance from a connection string.
 *
 * For PostgreSQL connections, the `pg-database` module is dynamically imported
 * so that the `pg` dependency is only required when actually using PostgreSQL.
 */
export async function createDatabaseFromUrl(connectionString: string): Promise<Database> {
  if (isPostgresUrl(connectionString)) {
    const { createPgDatabase } = await import("./pg-database.ts");
    return createPgDatabase(connectionString);
  }
  // SQLite: connectionString is a file path or ":memory:"
  return createSqliteDatabase(connectionString);
}
