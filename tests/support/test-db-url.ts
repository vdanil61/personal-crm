import { getDatabaseUrl } from "../../src/db/url";

// Tests run on their own database `<name>_test` in the same Postgres server,
// so the data in the working database is never touched.

function withDatabase(name: string): string {
  const url = new URL(getDatabaseUrl());
  url.pathname = `/${encodeURIComponent(name)}`;
  return url.toString();
}

export function getTestDatabaseName(): string {
  const workingName = decodeURIComponent(new URL(getDatabaseUrl()).pathname.slice(1));
  return workingName.endsWith("_test") ? workingName : `${workingName}_test`;
}

export function getTestDatabaseUrl(): string {
  return withDatabase(getTestDatabaseName());
}

// The `postgres` database exists in every server; it is used only to create the test database
export function getMaintenanceDatabaseUrl(): string {
  return withDatabase("postgres");
}
