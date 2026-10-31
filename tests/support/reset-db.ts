import type { Pool } from "pg";

import { getDb } from "@/db";

import { cleanDb } from "./clean-db";

// Before every Vitest test: the test database is emptied through the app's own connection
export async function resetDb() {
  await cleanDb(getDb());
}

// Closes the connection pool that src/db/index.ts keeps on globalThis, so the test process can exit
export async function closeDb() {
  const holder = globalThis as unknown as { pgPool?: Pool };
  await holder.pgPool?.end();
  holder.pgPool = undefined;
}
