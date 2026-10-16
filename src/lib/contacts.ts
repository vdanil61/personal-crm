import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { contacts, notes } from "@/db/schema";

export type ContactListItem = {
  id: string;
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
};

const nameCollator = new Intl.Collator("ru", { sensitivity: "base" });

export async function listContacts(): Promise<ContactListItem[]> {
  const rows = await getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      howWeMet: contacts.howWeMet,
      phone: contacts.phone,
    })
    .from(contacts);

  // Sort in JS: the database collation does not order Cyrillic (ё, case) the Russian way
  return rows.sort((a, b) => nameCollator.compare(a.name, b.name));
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
