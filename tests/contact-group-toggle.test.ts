import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { setContactGroup } from "@/app/actions";
import { getDb } from "@/db";
import { contacts, groups } from "@/db/schema";
import { listContactGroups } from "@/lib/groups";

import { addContact, findGroupId, putInGroup } from "./support/factories";

async function groupNamesOf(contactId: string) {
  return (await listContactGroups(contactId)).map((group) => group.name);
}

describe("Группы в карточке контакта: быстрая смена", () => {
  it("Добавить группу из карточки", async () => {
    const contact = await addContact("Анна Смирнова");

    const result = await setContactGroup(contact.id, await findGroupId("Семья"), true);

    expect(result).toEqual({ status: "success" });
    expect(await groupNamesOf(contact.id)).toEqual(["Семья"]);
  });

  it("Снять группу из карточки", async () => {
    const contact = await addContact("Анна Смирнова");
    await putInGroup(contact.id, "Семья");
    await putInGroup(contact.id, "Друзья");

    const result = await setContactGroup(contact.id, await findGroupId("Друзья"), false);

    expect(result).toEqual({ status: "success" });
    expect(await groupNamesOf(contact.id)).toEqual(["Семья"]);
  });

  it("Повторное добавление той же группы ничего не ломает", async () => {
    const contact = await addContact("Анна Смирнова");
    const familyId = await findGroupId("Семья");

    expect(await setContactGroup(contact.id, familyId, true)).toEqual({ status: "success" });
    expect(await setContactGroup(contact.id, familyId, true)).toEqual({ status: "success" });

    expect(await groupNamesOf(contact.id)).toEqual(["Семья"]);
  });

  it("Повторное снятие группы ничего не ломает", async () => {
    const contact = await addContact("Анна Смирнова");
    const familyId = await findGroupId("Семья");

    expect(await setContactGroup(contact.id, familyId, false)).toEqual({ status: "success" });

    expect(await groupNamesOf(contact.id)).toEqual([]);
  });

  it("Две быстрые отметки подряд не перетирают друг друга", async () => {
    const contact = await addContact("Анна Смирнова");

    await Promise.all([
      setContactGroup(contact.id, await findGroupId("Друзья"), true),
      setContactGroup(contact.id, await findGroupId("Теннис"), true),
    ]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья", "Теннис"]);
  });

  it("Группу удалили в другой вкладке", async () => {
    const contact = await addContact("Анна Смирнова");
    const tennisId = await findGroupId("Теннис");
    await getDb().delete(groups).where(eq(groups.id, tennisId));

    const result = await setContactGroup(contact.id, tennisId, true);

    expect(result).toEqual({ status: "error", message: "Эта группа больше не существует." });
  });

  it("Контакт удалили в другой вкладке", async () => {
    const contact = await addContact("Анна Смирнова");
    await getDb().delete(contacts).where(eq(contacts.id, contact.id));

    const result = await setContactGroup(contact.id, await findGroupId("Теннис"), true);

    expect(result).toEqual({ status: "error", message: "Этот контакт больше не существует." });
  });
});
