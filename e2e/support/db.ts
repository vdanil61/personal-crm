import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../../src/db/schema";
import { loadEnvFile } from "../../src/db/url";
import { cleanDb } from "../../tests/support/clean-db";
import { getTestDatabaseUrl } from "../../tests/support/test-db-url";

// The tests' own connection to the database of the app under test, `<name>_e2e`.
// Data a test only needs to exist goes straight into the database; what a test checks is done through the browser.
// The app code is not imported here: `server-only` in src/db/index.ts throws outside Next.js.

let pool: Pool | undefined;

function getDb() {
  if (!pool) {
    loadEnvFile();
    pool = new Pool({ connectionString: getTestDatabaseUrl("e2e") });
  }
  return drizzle(pool, { schema });
}

export async function resetDb() {
  await cleanDb(getDb());
}

export async function addContacts(...names: string[]) {
  await getDb()
    .insert(schema.contacts)
    .values(names.map((name) => ({ name })));
}

export async function addContact(name: string, values: Partial<typeof schema.contacts.$inferInsert> = {}) {
  const [contact] = await getDb()
    .insert(schema.contacts)
    .values({ name, ...values })
    .returning();
  return contact;
}

export async function addNote(contactId: string, createdAt: Date, body = "Созвонились") {
  await getDb().insert(schema.notes).values({ contactId, body, createdAt });
}

// Into one of the five default groups
export async function putInGroup(contactId: string, groupName: string) {
  const db = getDb();
  const [group] = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(eq(schema.groups.name, groupName));
  if (!group) throw new Error(`Test setup: no group named "${groupName}"`);
  await db.insert(schema.contactGroups).values({ contactId, groupId: group.id });
}

// One worker runs every test file in turn, so the next file opens a new pool
export async function closeDb() {
  await pool?.end();
  pool = undefined;
}
