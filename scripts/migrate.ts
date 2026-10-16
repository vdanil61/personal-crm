// Applies pending database migrations from ./drizzle and exits.
// On the server it runs as a one-off container before a new app version starts
// (see deploy/deploy.sh). Locally `pnpm db:migrate` (drizzle-kit) does the same job.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getDatabaseUrl, loadEnvFile } from "../src/db/url";

// Drizzle records applied migrations in this table, creating it on the first run
async function countApplied(pool: Pool): Promise<number> {
  const exists = await pool.query<{ found: boolean }>(
    "select to_regclass('drizzle.__drizzle_migrations') is not null as found",
  );
  if (!exists.rows[0].found) return 0;

  const applied = await pool.query<{ total: number }>(
    "select count(*)::int as total from drizzle.__drizzle_migrations",
  );
  return applied.rows[0].total;
}

async function main() {
  loadEnvFile();
  const pool = new Pool({ connectionString: getDatabaseUrl() });

  try {
    const before = await countApplied(pool);
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    const after = await countApplied(pool);
    console.log(`Migrations: ${after - before} applied now, ${after} in total.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
