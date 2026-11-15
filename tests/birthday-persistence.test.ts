import { beforeEach, expect, it } from "vitest";

import { createContact, deleteContact, restoreContact, updateContact } from "@/app/actions";
import { getContact, listNotes } from "@/lib/contacts";
import { listGroupsOfContacts } from "@/lib/groups";
import { contactSnapshotSchema } from "@/lib/validation";

import { signInWithGroups, type TestUser } from "./support/auth";
import { addContact, addNote, putInGroup } from "./support/factories";
import { testEmail } from "./support/mailpit";

let user: TestUser;
beforeEach(async () => {
  user = await signInWithGroups(testEmail("birthday"));
});
const idle = { status: "idle" } as const;
function form(day = "", month = "", year = "") {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Анна",
    birthdayDay: day,
    birthdayMonth: month,
    birthdayYear: year,
  }))
    data.set(key, value);
  return data;
}

it.each(["", "1990"])("creates, changes and clears a birthday with year %s", async (year) => {
  const result = await createContact(idle, form("15", "11", year));
  expect(result.status).toBe("success");
  if (result.status !== "success") throw new Error("Contact was not created");
  expect(await getContact(user.id, result.contactId)).toMatchObject({
    birthdayDay: 15,
    birthdayMonth: 11,
    birthdayYear: year ? 1990 : null,
  });
  expect((await updateContact(result.contactId, idle, form("16", "12"))).status).toBe("success");
  expect(await getContact(user.id, result.contactId)).toMatchObject({
    birthdayDay: 16,
    birthdayMonth: 12,
    birthdayYear: null,
  });
  expect((await updateContact(result.contactId, idle, form())).status).toBe("success");
  expect(await getContact(user.id, result.contactId)).toMatchObject({
    birthdayDay: null,
    birthdayMonth: null,
    birthdayYear: null,
  });
});

it("B29 preserves a contact created without birthday fields, its notes and groups", async () => {
  const contact = await addContact(user.id, "Старый контакт", { about: "Знакомый", phone: "+7 900 123-45-67" });
  const note = await addNote(contact.id, new Date());
  await putInGroup(user.id, contact.id, "Друзья");
  expect(await getContact(user.id, contact.id)).toMatchObject({
    ...contact,
    birthdayDay: null,
    birthdayMonth: null,
    birthdayYear: null,
  });
  expect(await listNotes(user.id, contact.id)).toEqual([note]);
  expect((await listGroupsOfContacts(user.id, [contact.id])).get(contact.id)?.map((g) => g.name)).toEqual(["Друзья"]);
});

it.each([null, 2000])("B30 restores the birthday with year %s", async (birthdayYear) => {
  const contact = await addContact(user.id, "Анна", { birthdayDay: 29, birthdayMonth: 2, birthdayYear });
  const deleted = await deleteContact(contact.id);
  expect(deleted.status).toBe("success");
  if (deleted.status !== "success") throw new Error("Contact was not deleted");
  expect(deleted.snapshot.contact).toMatchObject({ birthdayDay: 29, birthdayMonth: 2, birthdayYear });
  expect(await restoreContact(deleted.snapshot)).toEqual({ status: "success" });
  expect(await getContact(user.id, contact.id)).toEqual(contact);
});

it("restores an older snapshot with no birthday fields", async () => {
  const contact = await addContact(user.id, "Анна");
  const deleted = await deleteContact(contact.id);
  if (deleted.status !== "success") throw new Error("Contact was not deleted");
  const oldContact = { ...deleted.snapshot.contact };
  Reflect.deleteProperty(oldContact, "birthdayDay");
  Reflect.deleteProperty(oldContact, "birthdayMonth");
  Reflect.deleteProperty(oldContact, "birthdayYear");
  const snapshot = contactSnapshotSchema.parse({ ...deleted.snapshot, contact: oldContact });
  expect(snapshot.contact).toMatchObject({ birthdayDay: null, birthdayMonth: null, birthdayYear: null });
  expect(await restoreContact(snapshot)).toEqual({ status: "success" });
  expect(await getContact(user.id, contact.id)).toMatchObject({
    birthdayDay: null,
    birthdayMonth: null,
    birthdayYear: null,
  });
});
