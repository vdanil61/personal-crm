import "server-only";

import { type SQL, and, count, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { contacts, notes } from "@/db/schema";
import { type PageSize, toQueryWords } from "@/lib/search";

export type ContactListItem = {
  id: string;
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
};

export type ContactListPage = {
  items: ContactListItem[];
  // Search query as typed; empty when the whole list is shown
  query: string;
  // All contacts in the database, and how many of them match the query
  total: number;
  matched: number;
  // Starts at 1; a page past the end shows the last one
  page: number;
  pageCount: number;
  pageSize: PageSize;
};

// Russian alphabetical order: "ё" next to "е", case does not split names apart.
// The default collation of the database does not order Cyrillic this way.
const RU_COLLATION = sql.raw(`"ru-x-icu"`);
const nameOrder = sql`${contacts.name} collate ${RU_COLLATION}`;

// Every word of the query must appear somewhere in the name, in any order.
// The name is normalized like the query words (see normalizeForSearch).
function nameMatches(queryWords: string[]): SQL | undefined {
  return and(
    ...queryWords.map((word) => sql`strpos(replace(lower(${contacts.name}), 'ё', 'е'), ${word}) > 0`),
  );
}

export async function listContactsPage(query: string, page: number, pageSize: PageSize): Promise<ContactListPage> {
  const db = getDb();
  const where = nameMatches(toQueryWords(query));

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

  return {
    items,
    query,
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

export async function getContact(id: string) {
  const [contact] = await getDb().select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return contact ?? null;
}

export async function listNotes(contactId: string) {
  return getDb()
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt));
}
