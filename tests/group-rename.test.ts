import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { renameGroup } from "@/app/actions";
import { getDb } from "@/db";
import { groups } from "@/db/schema";
import { listContactGroups, listGroups } from "@/lib/groups";

import { addContact, findGroupId, putInGroup } from "./support/factories";

const idle = { status: "idle" } as const;

function nameForm(name: string) {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

const groupNames = async () => (await listGroups()).map((group) => group.name);

describe("Переименовать группу", () => {
  it("Переименовал", async () => {
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await putInGroup(anna.id, "Знакомые");
    await putInGroup(boris.id, "Знакомые");
    const groupId = await findGroupId("Знакомые");

    const result = await renameGroup(groupId, idle, nameForm("Приятели"));

    expect(result).toMatchObject({ status: "success", groupId, name: "Приятели" });
    // The same two people, the new name everywhere, the old one nowhere
    expect(await listContactGroups(anna.id)).toEqual([{ id: groupId, name: "Приятели" }]);
    expect(await listContactGroups(boris.id)).toEqual([{ id: groupId, name: "Приятели" }]);
    const list = await listGroups();
    expect(list.find((group) => group.id === groupId)).toMatchObject({ name: "Приятели", peopleCount: 2 });
    expect(list.map((group) => group.name)).not.toContain("Знакомые");
  });

  it("Переименовать в занятое название", async () => {
    const result = await renameGroup(await findGroupId("Друзья"), idle, nameForm("теннис"));

    expect(result).toMatchObject({ status: "error", name: "теннис", message: "Такая группа уже есть" });
    expect(await groupNames()).toEqual(["Аналитики", "Друзья", "Знакомые", "Семья", "Теннис"]);
  });

  it("Только регистр", async () => {
    const groupId = await findGroupId("Аналитики");
    await getDb().update(groups).set({ name: "аналитики" }).where(eq(groups.id, groupId));

    const result = await renameGroup(groupId, idle, nameForm("Аналитики"));

    expect(result).toMatchObject({ status: "success", name: "Аналитики" });
    expect(await groupNames()).toContain("Аналитики");
    expect(await groupNames()).not.toContain("аналитики");
  });

  it("Пустое и слишком длинное название", async () => {
    const groupId = await findGroupId("Семья");

    expect(await renameGroup(groupId, idle, nameForm("  "))).toMatchObject({
      status: "error",
      message: "Укажите название",
    });
    expect(await renameGroup(groupId, idle, nameForm("а".repeat(51)))).toMatchObject({
      status: "error",
      message: "Название слишком длинное — до 50 символов",
    });
    expect(await groupNames()).toContain("Семья");
  });

  it("Группу удалили, пока открыто окно переименования", async () => {
    const groupId = await findGroupId("Теннис");
    await getDb().delete(groups).where(eq(groups.id, groupId));

    const result = await renameGroup(groupId, idle, nameForm("Корт"));

    expect(result).toMatchObject({ status: "error", message: "Эта группа больше не существует." });
    expect(await groupNames()).not.toContain("Корт");
  });
});
