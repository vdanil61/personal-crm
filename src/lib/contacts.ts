import "server-only";

import { type SQL, and, count, desc, eq, isNotNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { contacts, notes } from "@/db/schema";
import { RU_COLLATION } from "@/lib/collation";
import { type ContactFrequency, frequencyIntervals } from "@/lib/contact-frequency";
import { ALL_GROUPS, type GroupFilter } from "@/lib/group-filter";
import type { GroupOption } from "@/lib/form-state";
import { groupFilterCondition, listGroupsOfContacts } from "@/lib/groups";
import { type PageSize, toQueryWords } from "@/lib/search";

export type ContactListItem = {
  id: string;
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
  // The groups the person is in, in Russian alphabetical order
  groups: GroupOption[];
};

export type OverdueContact = {
  id: string;
  name: string;
  frequency: ContactFrequency;
  // The latest note or "Связался"; null if there was neither
  lastContactAt: Date | null;
};

export type ContactListPage = {
  items: ContactListItem[];
  // Search query as typed; empty when the whole list is shown
  query: string;
  // The filter by groups the list was made with
  filter: GroupFilter;
  // All contacts in the database, and how many of them match the query and the filter
  total: number;
  matched: number;
  // Starts at 1; a page past the end shows the last one
  page: number;
  pageCount: number;
  pageSize: PageSize;
};

const nameOrder = sql`${contacts.name} collate ${RU_COLLATION}`;

// Every word of the query must appear somewhere in the name, in any order.
// The name is normalized like the query words (see normalizeForSearch).
function nameMatches(queryWords: string[]): SQL | undefined {
  return and(...queryWords.map((word) => sql`strpos(replace(lower(${contacts.name}), 'ё', 'е'), ${word}) > 0`));
}

export async function listContactsPage(
  query: string,
  page: number,
  pageSize: PageSize,
  filter: GroupFilter = ALL_GROUPS,
): Promise<ContactListPage> {
  const db = getDb();
  // The search and the filter work together: a contact has to pass both
  const where = and(nameMatches(toQueryWords(query)), groupFilterCondition(filter));

  const [counts] = await db
    .select({
      total: count(),
      matched: where ? sql<number>`count(*) filter (where ${where})`.mapWith(Number) : count(),
    })
    .from(contacts);

  const pageCount = Math.max(1, Math.ceil(counts.matched / pageSize));
  const currentPage = Math.min(page, pageCount);

  const items =
    counts.matched === 0
      ? []
      : await db
          .select({
            id: contacts.id,
            name: contacts.name,
            about: contacts.about,
            howWeMet: contacts.howWeMet,
            phone: contacts.phone,
          })
          .from(contacts)
          .where(where)
          .orderBy(nameOrder, contacts.id)
          .limit(pageSize)
          .offset((currentPage - 1) * pageSize);

  const groupsOfItems = await listGroupsOfContacts(items.map((item) => item.id));

  return {
    items: items.map((item) => ({ ...item, groups: groupsOfItems.get(item.id) ?? [] })),
    query,
    filter,
    total: counts.total,
    matched: counts.matched,
    page: currentPage,
    pageCount,
    pageSize,
  };
}

// The page of the full list (without search) that shows this contact; null if there is no such contact
export async function findContactPage(id: string, pageSize: PageSize): Promise<number | null> {
  const db = getDb();
  const [contact] = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, id)).limit(1);
  if (!contact) return null;

  const [{ before }] = await db
    .select({ before: count() })
    .from(contacts)
    .where(sql`(${nameOrder}, ${contacts.id}) < (${contact.name}::text collate ${RU_COLLATION}, ${id}::uuid)`);
  return Math.floor(before / pageSize) + 1;
}

const frequencyInterval = sql`case ${contacts.contactFrequency} ${sql.raw(
  Object.entries(frequencyIntervals)
    .map(([frequency, interval]) => `when '${frequency}' then interval '${interval}'`)
    .join(" "),
)} end`;

// Contacts whose keep-in-touch period has passed, the most overdue first.
// The last contact is the later of the latest note and the last "Связался";
// without either the period counts from when the contact was added.
// With a filter by groups only the people who pass it, the same condition as in the list.
export async function listOverdueContacts(filter: GroupFilter = ALL_GROUPS): Promise<OverdueContact[]> {
  const db = getDb();
  // Uses the notes (contact_id, created_at) index
  const lastNoteAt = sql`(select max(${notes.createdAt}) from ${notes} where ${notes.contactId} = ${contacts.id})`;
  const lastContactAt = sql`greatest(${lastNoteAt}, ${contacts.lastContactedAt})`;

  const withDue = db
    .select({
      id: contacts.id,
      name: contacts.name,
      frequency: sql<ContactFrequency>`${contacts.contactFrequency}`.as("frequency"),
      lastContactAt: lastContactAt.mapWith(contacts.lastContactedAt).as("last_contact_at"),
      dueAt: sql`coalesce(${lastContactAt}, ${contacts.createdAt}) + ${frequencyInterval}`.as("due_at"),
    })
    .from(contacts)
    .where(and(isNotNull(contacts.contactFrequency), groupFilterCondition(filter)))
    .as("with_due");

  return db
    .select({
      id: withDue.id,
      name: withDue.name,
      frequency: withDue.frequency,
      lastContactAt: withDue.lastContactAt,
    })
    .from(withDue)
    .where(sql`${withDue.dueAt} < now()`)
    .orderBy(withDue.dueAt, sql`${withDue.name} collate ${RU_COLLATION}`, withDue.id);
}

export async function getContact(id: string) {
  const [contact] = await getDb().select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return contact ?? null;
}

export async function listNotes(contactId: string) {
  return getDb().select().from(notes).where(eq(notes.contactId, contactId)).orderBy(desc(notes.createdAt));
}
