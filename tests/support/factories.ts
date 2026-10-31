import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

// Small helpers that put test data straight into the database, bypassing the app code under test

export async function addContact(name: string, values: Partial<typeof contacts.$inferInsert> = {}) {
  const [contact] = await getDb()
    .insert(contacts)
    .values({ name, ...values })
    .returning();
  return contact;
}

export async function addGroup(name: string) {
  const [group] = await getDb().insert(groups).values({ name }).returning();
  return group;
}

// The id of a group that already exists, e.g. one of the five default groups
export async function findGroupId(name: string): Promise<string> {
  const [group] = await getDb().select({ id: groups.id }).from(groups).where(eq(groups.name, name));
  if (!group) throw new Error(`Test setup: no group named "${name}"`);
  return group.id;
}

export async function putInGroup(contactId: string, groupName: string) {
  await getDb()
    .insert(contactGroups)
    .values({ contactId, groupId: await findGroupId(groupName) });
}
