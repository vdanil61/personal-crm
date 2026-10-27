import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { loadEnvFile } from "../../src/db/url";
import { getMaintenanceDatabaseUrl, getTestDatabaseName, getTestDatabaseUrl } from "./test-db-url";

async function createTestDatabaseIfMissing() {
  const name = getTestDatabaseName();
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

async function applyMigrations() {
  const pool = new Pool({ connectionString: getTestDatabaseUrl() });
  try {
    await migrate(drizzle(pool), { migrationsFolder: fromRoot("../../drizzle") });
  } finally {
    await pool.end();
  }
}

function fromRoot(path: string) {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default async function setup() {
  loadEnvFile();

  try {
    await createTestDatabaseIfMissing();
    await applyMigrations();
  } catch (error) {
    if ((error as { code?: string }).code === "ECONNREFUSED") {
      // Printed first: Vitest adds a misleading "No test files found" line after a failed global setup
      console.error(
        "\nCannot connect to the local database, so the tests cannot start.\n" +
          "Start it with `docker compose up -d --wait` and run `pnpm test` again.\n",
      );
      throw withoutStack("Cannot connect to the local database.");
    }
    throw error;
  }
}

// Vitest 5.0.5 fails with "code.charCodeAt is not a function" while printing the stack of an error
// thrown here and hides the message. An error without a stack is printed as plain text.
function withoutStack(message: string) {
  const error = new Error(message);
  error.stack = message;
  return error;
}
