import { beforeEach, expect, it } from "vitest";
import { createContact, updateContact } from "@/app/actions";
import { getContact, countContacts } from "@/lib/contacts";
import { signInWithGroups, type TestUser } from "./support/auth";
import { addContact } from "./support/factories";
import { testEmail } from "./support/mailpit";

let user: TestUser;
beforeEach(async () => {
  user = await signInWithGroups(testEmail("birthday-validation"));
});
const idle = { status: "idle" } as const;
function form(day: string, month: string, year: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Анна",
    about: "Знакомая",
    birthdayDay: day,
    birthdayMonth: month,
    birthdayYear: year,
  }))
    data.set(key, value);
  return data;
}
it.each([
  ["B06 day only", "15", "", "", "Укажите день и месяц"],
  ["B06 month only", "", "11", "", "Укажите день и месяц"],
  ["B06 year only", "", "", "1990", "Укажите день и месяц"],
  ["B07 April 31", "31", "4", "", "Проверьте дату рождения"],
  ["B08 common year", "29", "2", "1991", "Проверьте дату рождения"],
  ["fractional day", "1.5", "1", "", "Проверьте дату рождения"],
  ["non-numeric day", "no", "1", "", "Проверьте дату рождения"],
  ["scientific notation", "1e1", "1", "", "Проверьте дату рождения"],
  ["invalid year", "1", "1", "10000", "Проверьте дату рождения"],
])("%s is rejected by create and update without losing data", async (_, day, month, year, message) => {
  const old = await addContact(user.id, "Original", { birthdayDay: 15, birthdayMonth: 11, birthdayYear: 1990 });
  for (const save of [
    () => createContact(idle, form(day, month, year)),
    () => updateContact(old.id, idle, form(day, month, year)),
  ]) {
    expect(await save()).toMatchObject({
      status: "error",
      values: { name: "Анна", about: "Знакомая", birthdayDay: day, birthdayMonth: month, birthdayYear: year },
      fieldErrors: { birthdayDay: message },
    });
    expect(await getContact(user.id, old.id)).toEqual(old);
    expect(await countContacts(user.id)).toBe(1);
  }
});
it.each(["", "2000"])("B09 accepts February 29 with year %s", async (year) => {
  const result = await createContact(idle, form("29", "2", year));
  expect(result.status).toBe("success");
  if (result.status !== "success") throw new Error("Contact was not created");
  expect(await getContact(user.id, result.contactId)).toMatchObject({
    birthdayDay: 29,
    birthdayMonth: 2,
    birthdayYear: year ? 2000 : null,
  });
});

it.each([
  [null, 1, null],
  [1, null, null],
  [null, null, 1990],
  [0, 1, null],
  [32, 1, null],
  [31, 4, null],
  [1, 13, null],
  [29, 2, 1991],
  [29, 2, 2100],
  [1, 1, 0],
  [1, 1, 10000],
])(
  "database rejects invalid parts %s/%s/%s with a constraint violation",
  async (birthdayDay, birthdayMonth, birthdayYear) => {
    await expect(addContact(user.id, "Invalid", { birthdayDay, birthdayMonth, birthdayYear })).rejects.toMatchObject({
      cause: { code: "23514", constraint: "contacts_birthday_check" },
    });
  },
);

it.each([
  [null, null, null],
  [29, 2, null],
  [29, 2, 2000],
  [1, 1, 1],
  [31, 12, 9999],
])("database accepts valid parts %s/%s/%s", async (birthdayDay, birthdayMonth, birthdayYear) => {
  expect(await addContact(user.id, "Valid", { birthdayDay, birthdayMonth, birthdayYear })).toMatchObject({
    birthdayDay,
    birthdayMonth,
    birthdayYear,
  });
});
