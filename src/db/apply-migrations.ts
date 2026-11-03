import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Applies the migrations of ./drizzle. All pending migrations run in one transaction:
// if one fails, the database stays as it was.
//
// The owner's email reaches the migration that hands the existing data to the owner through
// the connection setting `app.owner_email`. It is passed as a parameter, never glued into SQL,
// and never written to the logs: deploy logs are public.
//
// Used by scripts/migrate.ts (the server and `pnpm db:migrate`), the test databases and the migration test.
export async function applyMigrations(url: string, ownerEmail?: string, migrationsFolder = "drizzle") {
  // One connection: the setting lives in the connection, and the migrations must run in that same one
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    if (ownerEmail !== undefined) {
      await pool.query("select set_config('app.owner_email', $1, false)", [ownerEmail]);
    }
    await migrate(drizzle(pool), { migrationsFolder });
  } catch (error) {
    // Drizzle wraps the database error and puts the whole SQL text into the message;
    // what the person who deploys needs to read is the database's own message
    const cause = (error as { cause?: unknown }).cause;
    throw cause instanceof Error ? cause : error;
  } finally {
    await pool.end();
  }
}
