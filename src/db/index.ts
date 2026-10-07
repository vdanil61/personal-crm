import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";
import { getDatabaseUrl } from "./url";

// Reuse one pool across hot reloads in development
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool = globalForDb.pgPool ?? new Pool({ connectionString: getDatabaseUrl(), max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });
