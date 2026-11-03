import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { CONTACT_FREQUENCIES } from "../lib/contact-frequency";

const frequencyList = sql.raw(CONTACT_FREQUENCIES.map((value) => `'${value}'`).join(", "));

// The four tables below belong to Better Auth (the login library): their columns are what it expects,
// the names are plural like ours. Ids are uuid, like the ids of contacts and groups.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Always in lower case: the login form and the owner setting both fold it
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per device the user is signed in on
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// Better Auth needs it; signing in by a link from an email hardly uses it
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

// Login links waiting to be opened: a fingerprint of the link, not the link itself
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// Who asked for a login link, and from where: the two limits on emails are counted from it
export const loginLinkRequests = pgTable(
  "login_link_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("login_link_requests_email_created_at_idx").on(table.email, table.createdAt),
    index("login_link_requests_ip_created_at_idx").on(table.ip, table.createdAt),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Whose contact it is
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
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
    index("contacts_user_id_idx").on(table.userId),
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

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Groups are the user's own: two users can both have "Друзья"
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // "Семья" and "семья", "Ёлки" and "Елки" are one name: the same folding as the search by name.
    // Unique among one user's groups only.
    uniqueIndex("groups_user_id_name_unique_idx").on(table.userId, sql`replace(lower(${table.name}), 'ё', 'е')`),
  ],
);

// Who is in which group; deleting a contact or a group removes its rows by itself
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    // For the filter by group and for the number of people in a group
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Group = typeof groups.$inferSelect;
