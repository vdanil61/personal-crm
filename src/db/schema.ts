import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { CONTACT_FREQUENCIES } from "../lib/contact-frequency";

const frequencyList = sql.raw(CONTACT_FREQUENCIES.map((value) => `'${value}'`).join(", "));

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Free-form "who is this person": role, job, relation
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // How often to keep in touch; null = not set
    contactFrequency: text("contact_frequency", { enum: CONTACT_FREQUENCIES }),
    // Last click on "Связался"; null = never
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  },
  (table) => [
    index("contacts_name_idx").on(table.name),
    check("contacts_contact_frequency_check", sql`${table.contactFrequency} in (${frequencyList})`),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notes_contact_id_created_at_idx").on(table.contactId, table.createdAt)],
);

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
