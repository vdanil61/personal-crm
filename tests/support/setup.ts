import { afterAll, beforeEach, vi } from "vitest";

import { loadEnvFile } from "../../src/db/url";
import { deleteTestEmails } from "./mailpit";
import { closeDb, resetDb } from "./reset-db";
import { getRequestHeaders, resetRequestHeaders } from "./request-context";
import { getTestDatabaseUrl } from "./test-db-url";

// Every test talks to the test database, never to the working one
loadEnvFile();
process.env.DATABASE_URL = getTestDatabaseUrl();
// Login links point here; the tests open them through the handler of Better Auth, not through a server
process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";

// `revalidatePath` works only inside a running Next.js app; here it does nothing
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Outside a running Next.js app `next/headers` has no request to read. The tests give it one:
// the headers of the "current request" (see tests/support/request-context.ts)
vi.mock("next/headers", () => ({
  headers: async () => getRequestHeaders(),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, has: () => false }),
}));

beforeEach(async () => {
  resetRequestHeaders();
  await resetDb();
  await deleteTestEmails();
});
afterAll(closeDb);
