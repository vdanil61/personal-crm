import { z } from "zod";

import { CONTACT_FREQUENCIES } from "./contact-frequency";

// Empty strings from the form become null in the database
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value === "" ? null : value));

const phonePattern = /^[\d\s()+\-.]*\d[\d\s()+\-.]*$/;

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(200, "Имя слишком длинное"),
  about: optionalText(500, "Слишком длинно — до 500 символов"),
  howWeMet: optionalText(500, "Слишком длинно — до 500 символов"),
  phone: optionalText(50, "Номер слишком длинный").refine(
    (value) => value === null || phonePattern.test(value),
    "В номере могут быть только цифры, пробелы и знаки + ( ) -",
  ),
  email: optionalText(254, "Адрес слишком длинный").refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Похоже, в адресе почты ошибка",
  ),
  // "" is "Не задано"
  contactFrequency: z
    .enum(["", ...CONTACT_FREQUENCIES], { error: "Выберите частоту из списка" })
    .transform((value) => (value === "" ? null : value)),
});

export type ContactInput = z.output<typeof contactInputSchema>;
export type ContactField = keyof z.input<typeof contactInputSchema>;
export const contactFields: ContactField[] = ["name", "about", "howWeMet", "phone", "email", "contactFrequency"];

export const noteInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Заметка пустая")
    .max(10_000, "Заметка слишком длинная — до 10 000 символов"),
});

// Whether the name is taken is decided by the unique index in the database, not here
export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название")
  .max(50, "Название слишком длинное — до 50 символов");

export const idSchema = z.uuid();

// The groups ticked in the contact form; one group sent twice counts once.
// Whether a group still exists is checked when the contact is saved, not here.
export const groupIdsSchema = z.array(idSchema).transform((ids) => [...new Set(ids)]);

// A deleted contact with its notes, kept by the browser for "undo".
// Only the shape is checked: the form rules above would turn null into "" and could
// reject data saved before they changed, so undo would fail and the contact be lost.
const nullableText = z.string().nullable();

export const contactSnapshotSchema = z.object({
  contact: z.object({
    id: idSchema,
    name: z.string(),
    about: nullableText,
    howWeMet: nullableText,
    phone: nullableText,
    email: nullableText,
    createdAt: z.date(),
    updatedAt: z.date(),
    // Missing in a snapshot made by an older version of the app: treated as empty
    contactFrequency: z.enum(CONTACT_FREQUENCIES).nullable().default(null),
    lastContactedAt: z.date().nullable().default(null),
  }),
  notes: z.array(z.object({ id: idSchema, body: z.string(), createdAt: z.date() })),
  // The groups the contact was in; missing in a snapshot made before groups existed: no groups
  groupIds: z.array(idSchema).default([]),
});

export type ContactSnapshot = z.output<typeof contactSnapshotSchema>;

// A deleted group with the ids of its people, kept by the browser for "undo".
// Only the shape is checked, for the same reason as for the contact above.
export const groupSnapshotSchema = z.object({
  group: z.object({ id: idSchema, name: z.string(), createdAt: z.date() }),
  contactIds: z.array(idSchema),
});

export type GroupSnapshot = z.output<typeof groupSnapshotSchema>;
