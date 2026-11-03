import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { contactGroups, contacts, groups, notes, users } from "@/db/schema";

import { TEST_EMAIL_DOMAIN } from "./mailpit";

// Small helpers that put test data straight into the database, bypassing the app code under test

let userCounter = 0;

// A user as the login creates them: the email is in lower case, the name is empty
export async function addUser(email = `user-${++userCounter}@${TEST_EMAIL_DOMAIN}`) {
  const [user] = await getDb().insert(users).values({ name: "", email, emailVerified: true }).returning();
  return user;
}

export async function addContact(userId: string, name: string, values: Partial<typeof contacts.$inferInsert> = {}) {
  const [contact] = await getDb()
    .insert(contacts)
    .values({ userId, name, ...values })
    .returning();
  return contact;
}

// A note written at the given moment; the text does not matter to the tests that use it
export async function addNote(contactId: string, createdAt: Date) {
  const [note] = await getDb().insert(notes).values({ contactId, body: "Созвонились", createdAt }).returning();
  return note;
}

export async function addGroup(userId: string, name: string) {
  const [group] = await getDb().insert(groups).values({ userId, name }).returning();
  return group;
}

// The id of a group of this user
export async function findGroupId(userId: string, name: string): Promise<string> {
  const [group] = await getDb()
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.userId, userId), eq(groups.name, name)));
  if (!group) throw new Error(`Test setup: no group named "${name}"`);
  return group.id;
}

export async function putInGroup(userId: string, contactId: string, groupName: string) {
  await getDb()
    .insert(contactGroups)
    .values({ contactId, groupId: await findGroupId(userId, groupName) });
}

export async function addDefaultGroups(userId: string) {
  await getDb()
    .insert(groups)
    .values(["Аналитики", "Друзья", "Знакомые", "Семья", "Теннис"].map((name) => ({ userId, name })));
}
