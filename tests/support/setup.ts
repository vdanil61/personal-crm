import { afterAll, beforeEach, vi } from "vitest";

import { loadEnvFile } from "../../src/db/url";
import { closeDb, resetDb } from "./reset-db";
import { getTestDatabaseUrl } from "./test-db-url";

// Every test talks to the test database, never to the working one
loadEnvFile();
process.env.DATABASE_URL = getTestDatabaseUrl();

// `revalidatePath` works only inside a running Next.js app; here it does nothing
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

beforeEach(resetDb);
afterAll(closeDb);
