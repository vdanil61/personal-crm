import { z } from "zod";

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
});

export type ContactInput = z.output<typeof contactInputSchema>;
export type ContactField = keyof z.input<typeof contactInputSchema>;
export const contactFields: ContactField[] = ["name", "about", "howWeMet", "phone", "email"];

export const noteInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Заметка пустая")
    .max(10_000, "Заметка слишком длинная — до 10 000 символов"),
});

export const idSchema = z.uuid();
