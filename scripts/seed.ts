// Fills an empty database with realistic test contacts and notes of the owner (OWNER_EMAIL).
// An owner who already has contacts is left alone.
// Usage: pnpm db:seed [count]   (default: 1000)
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema";
import { seedDemoData } from "../src/db/seed-demo-data";
import { getDatabaseUrl, loadEnvFile } from "../src/db/url";

async function main() {
  loadEnvFile();
  const total = Number(process.argv[2] ?? 1000);
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`Contact count must be a positive integer, got "${process.argv[2]}"`);
  }

  const pool = new Pool({ connectionString: getDatabaseUrl() });
  try {
    const result = await seedDemoData(drizzle(pool, { schema }), process.env.OWNER_EMAIL ?? "", total);
    if (result.status === "skipped") {
      console.log(`The owner already has ${result.existing} contacts, demo data skipped to keep your data intact.`);
    } else {
      console.log(
        `Seeded ${result.contacts} contacts and ${result.notes} notes, ${result.memberships} group memberships.`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
