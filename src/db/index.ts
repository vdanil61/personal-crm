import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";
import { getDatabaseUrl } from "./url";

// Reuse one pool across hot reloads in development
const globalForDb = globalThis as unknown as { pgPool?: Pool };

let db: NodePgDatabase<typeof schema> | undefined;

// Connects on first use, not at import: `next build` loads route modules to read their
// config, and the production build (Docker image in CI) has no database settings.
export function getDb() {
  if (!db) {
    const pool = globalForDb.pgPool ?? new Pool({ connectionString: getDatabaseUrl(), max: 10 });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.pgPool = pool;
    }
    db = drizzle(pool, { schema });
  }
  return db;
}
