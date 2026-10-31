import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "../../src/db/schema";

// Relative to the project root, where both test runners start
const DEFAULT_GROUPS_MIGRATION = "drizzle/0003_default_groups.sql";

// Empties every table of a test database, so each test starts from nothing,
// then adds the five default groups the same way the real migration does.
// Tables are read from the database, so a table added by a new migration is cleaned too.
// Vitest passes the app's own connection (tests/support/reset-db.ts), Playwright its own one (e2e/support/db.ts).
export async function cleanDb(db: NodePgDatabase<typeof schema>) {
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (tables.rows.length > 0) {
    const names = tables.rows.map((row) => `"${row.tablename}"`).join(", ");
    await db.execute(sql.raw(`truncate table ${names} restart identity cascade`));
  }

  // The text of the migration itself, so the test "Группы после выкатки" checks the real thing
  const statements = readFileSync(DEFAULT_GROUPS_MIGRATION, "utf8").split("--> statement-breakpoint");
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}
