import { Pool } from "pg";

import { applyMigrations } from "../../src/db/apply-migrations";
import { getMaintenanceDatabaseUrl, getTestDatabaseName, getTestDatabaseUrl } from "./test-db-url";

// A made-up owner for the data every migrated database already has (the five default groups)
const OWNER_EMAILS = { test: "owner@vitest.example.com", e2e: "owner@e2e.example.com" };

// Creates the database of a test suite if it is missing and applies the migrations to it.
// Used before Vitest (tests/support/global-setup.ts) and before Playwright (e2e/support/prepare-db.ts).
export async function prepareTestDatabase(suite: "test" | "e2e") {
  await createDatabaseIfMissing(getTestDatabaseName(suite));
  // Relative to the project root, where both test runners start, as in scripts/migrate.ts
  await applyMigrations(getTestDatabaseUrl(suite), OWNER_EMAILS[suite]);
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
