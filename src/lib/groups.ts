import "server-only";

import { type SQL, and, count, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";
import { RU_COLLATION } from "@/lib/collation";
import type { GroupOption } from "@/lib/form-state";
import { ALL_GROUPS, type GroupFilter, parseGroupFilter } from "@/lib/group-filter";
import type { GroupSnapshot } from "@/lib/validation";

export type GroupListItem = {
  id: string;
  name: string;
  peopleCount: number;
};

// A database transaction, as `getDb().transaction(async (tx) => ...)` hands it out
export type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// Makes these groups the groups of the contact, as the contact form does: the ones not listed
// are dropped. Groups deleted while the form was open are skipped without an error.
export async function replaceContactGroups(tx: Tx, contactId: string, groupIds: string[]) {
  await tx.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (groupIds.length === 0) return;

  // The lock keeps these groups from being deleted before the rows below are written
  const existing = await tx.select({ id: groups.id }).from(groups).where(inArray(groups.id, groupIds)).for("share");
  if (existing.length > 0) {
    await tx.insert(contactGroups).values(existing.map((group) => ({ contactId, groupId: group.id })));
  }
}

// Adds or removes one group of one contact, as a tick in the contact card does.
// One link at a time, so two quick ticks in a row don't overwrite each other.
// Doing it twice is fine. Says what is missing when the contact or the group is already gone.
export async function setContactGroupMembership(
  contactId: string,
  groupId: string,
  member: boolean,
): Promise<"done" | "no-contact" | "no-group"> {
  return getDb().transaction(async (tx) => {
    if (!member) {
      await tx
        .delete(contactGroups)
        .where(and(eq(contactGroups.contactId, contactId), eq(contactGroups.groupId, groupId)));
      return "done";
    }

    // The locks keep both from being deleted before the row below is written
    const [contact] = await tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId)).for("share");
    if (!contact) return "no-contact";
    const [group] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("share");
    if (!group) return "no-group";

    await tx.insert(contactGroups).values({ contactId, groupId }).onConflictDoNothing();
    return "done";
  });
}

// Fails with Postgres error 23505 if a group with this name already exists (see groups_name_unique_idx)
export async function insertGroup(name: string) {
  const [group] = await getDb().insert(groups).values({ name }).returning({ id: groups.id, name: groups.name });
  return group;
}

// Fails with Postgres error 23505 if another group already has this name; null if there is no such group.
// Changing only the case of the name is fine: the group does not clash with itself.
export async function renameGroupRow(id: string, name: string) {
  const [group] = await getDb()
    .update(groups)
    .set({ name })
    .where(eq(groups.id, id))
    .returning({ id: groups.id, name: groups.name });
  return group ?? null;
}

// Deletes the group and returns it with the ids of its people, so the browser can undo it;
// null if there is no such group. The people stay in contacts.
export async function deleteGroupWithSnapshot(id: string): Promise<GroupSnapshot | null> {
  return getDb().transaction(async (tx) => {
    // The lock makes a person being added in another tab wait, so they can't be
    // dropped from the group without getting into the snapshot
    const [group] = await tx.select().from(groups).where(eq(groups.id, id)).for("update");
    if (!group) return null;
    const members = await tx
      .select({ contactId: contactGroups.contactId })
      .from(contactGroups)
      .where(eq(contactGroups.groupId, id));
    // The rows of contact_groups go with it: ON DELETE CASCADE
    await tx.delete(groups).where(eq(groups.id, id));
    return { group, contactIds: members.map((member) => member.contactId) };
  });
}

// Undo of deleteGroupWithSnapshot: puts the group back with the same id and date, and the people
// who are still in contacts. Fails with Postgres error 23505 if a group with this name appeared meanwhile.
export async function restoreGroupFromSnapshot({ group, contactIds }: GroupSnapshot) {
  await getDb().transaction(async (tx) => {
    const restored = await tx
      .insert(groups)
      .values(group)
      .onConflictDoNothing({ target: groups.id })
      .returning({ id: groups.id });
    // Already restored: a second click on "undo" or another tab
    if (restored.length === 0) return;

    for (let i = 0; i < contactIds.length; i += 1000) {
      // The lock keeps these contacts from being deleted before the rows below are written
      const existing = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(inArray(contacts.id, contactIds.slice(i, i + 1000)))
        .for("share");
      if (existing.length > 0) {
        await tx.insert(contactGroups).values(existing.map((contact) => ({ contactId: contact.id, groupId: group.id })));
      }
    }
  });
}

// The groups of one contact in Russian alphabetical order
export async function listContactGroups(contactId: string) {
  return getDb()
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, contactId))
    .orderBy(sql`${groups.name} collate ${RU_COLLATION}`, groups.id);
}

// The condition of the filter for a query on `contacts`: undefined for "Все"; for "Без группы" a contact
// without any group; for selected groups a contact that is in every one of them (not in any one of them).
// One condition for the list, the counter and the "keep in touch" block, so they never disagree.
export function groupFilterCondition(filter: GroupFilter): SQL | undefined {
  if (filter.mode === "none") {
    return sql`not exists (select 1 from ${contactGroups} where ${contactGroups.contactId} = ${contacts.id})`;
  }
  if (filter.mode === "groups") {
    return and(
      ...filter.ids.map(
        (groupId) =>
          sql`exists (select 1 from ${contactGroups} where ${contactGroups.contactId} = ${contacts.id} and ${contactGroups.groupId} = ${groupId})`,
      ),
    );
  }
  return undefined;
}

// The groups of several contacts at once, each list in Russian alphabetical order
export async function listGroupsOfContacts(contactIds: string[]): Promise<Map<string, GroupOption[]>> {
  const byContact = new Map<string, GroupOption[]>();
  if (contactIds.length === 0) return byContact;

  const rows = await getDb()
    .select({ contactId: contactGroups.contactId, id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(inArray(contactGroups.contactId, contactIds))
    .orderBy(sql`${groups.name} collate ${RU_COLLATION}`, groups.id);
  for (const row of rows) {
    byContact.set(row.contactId, [...(byContact.get(row.contactId) ?? []), { id: row.id, name: row.name }]);
  }
  return byContact;
}

// The filter from the "groups" parameter of the address, with groups that no longer exist left out;
// if none is left it is "Все", so an old link never breaks the page
export async function resolveGroupFilter(value: string | null | undefined): Promise<GroupFilter> {
  const parsed = parseGroupFilter(value);
  if (parsed.mode !== "groups") return parsed;

  const existing = await getDb().select({ id: groups.id }).from(groups).where(inArray(groups.id, parsed.ids));
  const known = new Set(existing.map((group) => group.id));
  const ids = parsed.ids.filter((id) => known.has(id));
  return ids.length === 0 ? ALL_GROUPS : { mode: "groups", ids };
}

// All groups in Russian alphabetical order, each with the number of people in it
export async function listGroups(): Promise<GroupListItem[]> {
  return getDb()
    .select({ id: groups.id, name: groups.name, peopleCount: count(contactGroups.contactId) })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(sql`${groups.name} collate ${RU_COLLATION}`, groups.id);
}
