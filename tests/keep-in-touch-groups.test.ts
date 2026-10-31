import { describe, expect, it } from "vitest";

import { listOverdueContacts } from "@/lib/contacts";
import { ALL_GROUPS, type GroupFilter } from "@/lib/group-filter";

import { addContact, findGroupId, putInGroup } from "./support/factories";

const DAY = 24 * 60 * 60 * 1000;
const longAgo = () => new Date(Date.now() - 40 * DAY);

// A person whose weekly period has passed long ago
const overdue = (name: string) => addContact(name, { contactFrequency: "week", createdAt: longAgo() });

const selected = async (...groupNames: string[]): Promise<GroupFilter> => ({
  mode: "groups",
  ids: await Promise.all(groupNames.map(findGroupId)),
});
const overdueNames = async (filter: GroupFilter = ALL_GROUPS) =>
  (await listOverdueContacts(filter)).map((c) => c.name).sort();

describe("Блок «Пора связаться» на главной", () => {
  it("Есть просроченные", async () => {
    await overdue("Анна Смирнова");
    await overdue("Борис Медведев");
    await overdue("Вера Николаева");
    await addContact("Глеб Фёдоров", { contactFrequency: "year" });

    expect(await overdueNames()).toEqual(["Анна Смирнова", "Борис Медведев", "Вера Николаева"]);
  });

  it("Просроченных нет", async () => {
    await addContact("Анна Смирнова", { contactFrequency: "year" });
    await addContact("Борис Медведев");

    expect(await overdueNames()).toEqual([]);
  });

  it("Фильтр по группе в блоке", async () => {
    const mother = await overdue("Мария Ковалёва");
    const brother = await overdue("Олег Васильев");
    await overdue("Алексей Зайцев");
    await putInGroup(mother.id, "Семья");
    await putInGroup(brother.id, "Семья");

    const inBlock = await listOverdueContacts(await selected("Семья"));

    // Two from "Семья", the third (no groups) is not in the block
    expect(inBlock.map((c) => c.name).sort()).toEqual(["Мария Ковалёва", "Олег Васильев"]);
  });

  it("Среди выбранных групп просроченных нет", async () => {
    const anna = await overdue("Анна Смирнова");
    await putInGroup(anna.id, "Друзья");
    await overdue("Борис Медведев");
    const tennisPlayer = await addContact("Вера Николаева", { contactFrequency: "year" });
    await putInGroup(tennisPlayer.id, "Теннис");

    // Overdue people exist, but none of them is in "Теннис"
    expect(await overdueNames(await selected("Теннис"))).toEqual([]);
    // Without the filter the block is back
    expect(await overdueNames()).toEqual(["Анна Смирнова", "Борис Медведев"]);
  });

  it("Без группы в блоке", async () => {
    const friend = await overdue("Анна Смирнова");
    await overdue("Борис Медведев");
    await putInGroup(friend.id, "Друзья");

    expect(await overdueNames({ mode: "none" })).toEqual(["Борис Медведев"]);
  });

  it("Две группы в блоке — во всех сразу", async () => {
    const both = await overdue("Анна Смирнова");
    const onlyFriend = await overdue("Борис Медведев");
    await putInGroup(both.id, "Друзья");
    await putInGroup(both.id, "Теннис");
    await putInGroup(onlyFriend.id, "Друзья");

    expect(await overdueNames(await selected("Друзья", "Теннис"))).toEqual(["Анна Смирнова"]);
  });
});
