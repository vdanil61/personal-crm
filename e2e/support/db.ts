import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../../src/db/schema";
import { loadEnvFile } from "../../src/db/url";
import { cleanDb } from "../../tests/support/clean-db";
import { getTestDatabaseUrl } from "../../tests/support/test-db-url";
import { mailbox } from "./mailpit";

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
  await mailbox.deleteTestEmails();
}

// A user as the login creates them. Signing in as them still goes through the login form.
export async function addUser(email: string) {
  const [user] = await getDb().insert(schema.users).values({ name: "", email, emailVerified: true }).returning();
  return user;
}

export async function addContacts(userId: string, ...names: string[]) {
  await getDb()
    .insert(schema.contacts)
    .values(names.map((name) => ({ userId, name })));
}

export async function addContact(
  userId: string,
  name: string,
  values: Partial<typeof schema.contacts.$inferInsert> = {},
) {
  const [contact] = await getDb()
    .insert(schema.contacts)
    .values({ userId, name, ...values })
    .returning();
  return contact;
}

export async function addNote(contactId: string, createdAt: Date, body = "Созвонились") {
  await getDb().insert(schema.notes).values({ contactId, body, createdAt });
}

// Into a group of the user, created on the way if the user has none of that name
export async function putInGroup(userId: string, contactId: string, groupName: string) {
  const db = getDb();
  const [found] = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(and(eq(schema.groups.userId, userId), eq(schema.groups.name, groupName)));
  const groupId = found?.id ?? (await db.insert(schema.groups).values({ userId, name: groupName }).returning())[0].id;
  await db.insert(schema.contactGroups).values({ contactId, groupId });
}

// Time travel: the logins of a user look as if they were made `days` days ago
export async function ageSessions(email: string, days: number) {
  await getDb().execute(sql`
    update sessions set
      updated_at = updated_at - make_interval(days => ${days}),
      expires_at = expires_at - make_interval(days => ${days})
    where user_id = (select id from users where email = ${email})
  `);
}

// The login of a user ended a minute ago
export async function expireSessions(email: string) {
  await getDb().execute(sql`
    update sessions set expires_at = now() - interval '1 minute'
    where user_id = (select id from users where email = ${email})
  `);
}

export async function readSessionExpiry(email: string): Promise<Date[]> {
  const result = await getDb().execute<{ expires_at: Date }>(sql`
    select expires_at from sessions where user_id = (select id from users where email = ${email}) order by created_at
  `);
  return result.rows.map((row) => new Date(row.expires_at));
}

// One worker runs every test file in turn, so the next file opens a new pool
export async function closeDb() {
  await pool?.end();
  pool = undefined;
}
