import { getDatabaseUrl } from "../../src/db/url";

// Tests run on their own databases in the same Postgres server: Vitest on `<name>_test`,
// Playwright on `<name>_e2e`. The data in the working database is never touched,
// and the two kinds of tests can run at the same time.

// `test_migration` is the database of the migration test: it is recreated from nothing for every test
export type TestSuite = "test" | "e2e" | "test_migration";

function withDatabase(name: string): string {
  const url = new URL(getDatabaseUrl());
  url.pathname = `/${encodeURIComponent(name)}`;
  return url.toString();
}

export function getTestDatabaseName(suite: TestSuite = "test"): string {
  const suffix = `_${suite}`;
  const workingName = decodeURIComponent(new URL(getDatabaseUrl()).pathname.slice(1));
  return workingName.endsWith(suffix) ? workingName : `${workingName}${suffix}`;
}

export function getTestDatabaseUrl(suite: TestSuite = "test"): string {
  return withDatabase(getTestDatabaseName(suite));
}

// The `postgres` database exists in every server; it is used only to create the test databases
export function getMaintenanceDatabaseUrl(): string {
  return withDatabase("postgres");
}
