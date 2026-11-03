import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "../../src/db/schema";

// Empties every table of a test database, so each test starts from nothing.
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
}
