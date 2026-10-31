import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createContact, updateContact } from "@/app/actions";
import { getDb } from "@/db";
import { contacts, groups } from "@/db/schema";
import { listContactGroups } from "@/lib/groups";

import { addContact, findGroupId, putInGroup } from "./support/factories";

const idle = { status: "idle" } as const;

// What the browser sends: the text fields and one "groupIds" entry per ticked group
function contactForm({ name = "Анна Смирнова", groupIds = [] }: { name?: string; groupIds?: string[] } = {}) {
  const formData = new FormData();
  formData.set("name", name);
  for (const id of groupIds) formData.append("groupIds", id);
  return formData;
}

async function groupNamesOf(contactId: string) {
  return (await listContactGroups(contactId)).map((group) => group.name);
}

async function savedContactId(result: Awaited<ReturnType<typeof createContact>>) {
  if (result.status !== "success") throw new Error(`Test setup: contact was not saved: ${JSON.stringify(result)}`);
  return result.contactId;
}

describe("Группы в форме контакта", () => {
  it("Добавить контакт сразу в две группы", async () => {
    const groupIds = [await findGroupId("Друзья"), await findGroupId("Теннис")];

    const result = await createContact(idle, contactForm({ groupIds }));

    expect(await groupNamesOf(await savedContactId(result))).toEqual(["Друзья", "Теннис"]);
  });

  it("Убрать группу в форме изменения", async () => {
    const contact = await addContact("Анна Смирнова");
    await putInGroup(contact.id, "Друзья");
    await putInGroup(contact.id, "Теннис");

    // "Теннис" is unticked: the form sends only "Друзья"
    const result = await updateContact(contact.id, idle, contactForm({ groupIds: [await findGroupId("Друзья")] }));

    expect(result).toMatchObject({ status: "success" });
    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
  });

  it("Снять все группы в форме изменения", async () => {
    const contact = await addContact("Анна Смирнова");
    await putInGroup(contact.id, "Друзья");

    await updateContact(contact.id, idle, contactForm());

    expect(await groupNamesOf(contact.id)).toEqual([]);
  });

  it("Ошибка в форме не сбрасывает группы", async () => {
    const familyId = await findGroupId("Семья");

    const result = await createContact(idle, contactForm({ name: "", groupIds: [familyId] }));

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { name: "Укажите имя" },
      values: { groupIds: [familyId] },
    });
    expect(await getDb().select({ id: contacts.id }).from(contacts)).toHaveLength(0);

    // The same on the "Изменить" form
    const contact = await addContact("Анна Смирнова");
    const updateResult = await updateContact(contact.id, idle, contactForm({ name: " ", groupIds: [familyId] }));
    expect(updateResult).toMatchObject({ status: "error", values: { groupIds: [familyId] } });
    expect(await groupNamesOf(contact.id)).toEqual([]);
  });

  it("Групп нет", async () => {
    await getDb().delete(groups);

    const result = await createContact(idle, contactForm());

    expect(await groupNamesOf(await savedContactId(result))).toEqual([]);
  });

  it("Группу удалили, пока форма была открыта — контакт сохраняется без неё", async () => {
    const tennisId = await findGroupId("Теннис");
    const friendsId = await findGroupId("Друзья");
    await getDb().delete(groups).where(eq(groups.id, tennisId));

    const created = await createContact(idle, contactForm({ groupIds: [friendsId, tennisId] }));
    expect(await groupNamesOf(await savedContactId(created))).toEqual(["Друзья"]);

    const contact = await addContact("Борис Медведев");
    const updated = await updateContact(contact.id, idle, contactForm({ groupIds: [tennisId] }));
    expect(updated).toMatchObject({ status: "success" });
    expect(await groupNamesOf(contact.id)).toEqual([]);
  });

  it("Одна группа дважды в запросе не мешает", async () => {
    const friendsId = await findGroupId("Друзья");

    const result = await createContact(idle, contactForm({ groupIds: [friendsId, friendsId] }));

    expect(await groupNamesOf(await savedContactId(result))).toEqual(["Друзья"]);
  });

  it("Неправильный номер группы — ошибка, контакт не создаётся", async () => {
    await expect(createContact(idle, contactForm({ groupIds: ["not-an-id"] }))).rejects.toThrow("Invalid group id");

    expect(await getDb().select({ id: contacts.id }).from(contacts)).toHaveLength(0);
  });
});
