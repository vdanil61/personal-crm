import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { type TestSuite, getMaintenanceDatabaseUrl, getTestDatabaseName, getTestDatabaseUrl } from "./test-db-url";

// Creates the database of a test suite if it is missing and applies the migrations to it.
// Used before Vitest (tests/support/global-setup.ts) and before Playwright (e2e/support/prepare-db.ts).
export async function prepareTestDatabase(suite: TestSuite) {
  await createDatabaseIfMissing(getTestDatabaseName(suite));
  await applyMigrations(getTestDatabaseUrl(suite));
}

async function createDatabaseIfMissing(name: string) {
  const pool = new Pool({ connectionString: getMaintenanceDatabaseUrl() });
  try {
    const found = await pool.query("select 1 from pg_database where datname = $1", [name]);
    if (found.rowCount === 0) {
      // An identifier cannot be passed as a query parameter, so it is quoted by hand
      await pool.query(`create database "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await pool.end();
  }
}

async function applyMigrations(url: string) {
  const pool = new Pool({ connectionString: url });
  try {
    // Relative to the project root, where both test runners start, as in scripts/migrate.ts
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}
