// Applies pending database migrations from ./drizzle and exits.
// On the server it runs as a one-off container before a new app version starts
// (see deploy/deploy.sh); locally `pnpm db:migrate` runs the same script.
// OWNER_EMAIL is the owner of the data that existed before the login feature.
import { Pool } from "pg";

import { applyMigrations } from "../src/db/apply-migrations";
import { getDatabaseUrl, loadEnvFile } from "../src/db/url";

// Drizzle records applied migrations in this table, creating it on the first run
async function countApplied(url: string): Promise<number> {
  const pool = new Pool({ connectionString: url });
  try {
    const exists = await pool.query<{ found: boolean }>(
      "select to_regclass('drizzle.__drizzle_migrations') is not null as found",
    );
    if (!exists.rows[0].found) return 0;

    const applied = await pool.query<{ total: number }>(
      "select count(*)::int as total from drizzle.__drizzle_migrations",
    );
    return applied.rows[0].total;
  } finally {
    await pool.end();
  }
}

async function main() {
  loadEnvFile();
  const url = getDatabaseUrl();

  const before = await countApplied(url);
  await applyMigrations(url, process.env.OWNER_EMAIL);
  const after = await countApplied(url);
  console.log(`Migrations: ${after - before} applied now, ${after} in total.`);
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
