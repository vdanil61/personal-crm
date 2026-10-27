import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import type { Pool } from "pg";

import { getDb } from "@/db";

const DEFAULT_GROUPS_MIGRATION = fileURLToPath(new URL("../../drizzle/0003_default_groups.sql", import.meta.url));

// Empties every table of the test database, so each test starts from nothing,
// then adds the five default groups the same way the real migration does.
// Tables are read from the database, so a table added by a new migration is cleaned too.
export async function resetDb() {
  const db = getDb();

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

// Closes the connection pool that src/db/index.ts keeps on globalThis, so the test process can exit
export async function closeDb() {
  const holder = globalThis as unknown as { pgPool?: Pool };
  await holder.pgPool?.end();
  holder.pgPool = undefined;
}
