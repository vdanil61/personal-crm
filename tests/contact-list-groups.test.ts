import { beforeEach, describe, expect, it } from "vitest";

import { setContactGroup } from "@/app/actions";
import { listContactsPage } from "@/lib/contacts";
import { ALL_GROUPS, type GroupFilter } from "@/lib/group-filter";

import { addContact, findGroupId, putInGroup } from "./support/factories";
import { type TestUser, signInWithGroups } from "./support/auth";
import { testEmail } from "./support/mailpit";

let user: TestUser;

beforeEach(async () => {
  user = await signInWithGroups(testEmail("owner"));
});

const selected = async (...groupNames: string[]): Promise<GroupFilter> => ({
  mode: "groups",
  ids: await Promise.all(groupNames.map((name) => findGroupId(user.id, name))),
});

const list = (filter: GroupFilter = ALL_GROUPS, query = "", page = 1, size: 10 | 20 | 50 = 50) =>
  listContactsPage(user.id, query, page, size, filter);
const names = (result: Awaited<ReturnType<typeof list>>) => result.items.map((item) => item.name);

// Анна: Друзья и Теннис; Борис: только Друзья; Вера: только Теннис; Глеб: без групп
async function fourPeople() {
  const anna = await addContact(user.id, "Анна Смирнова");
  const boris = await addContact(user.id, "Борис Медведев");
  const vera = await addContact(user.id, "Вера Николаева");
  const gleb = await addContact(user.id, "Глеб Фёдоров");
  await putInGroup(user.id, anna.id, "Друзья");
  await putInGroup(user.id, anna.id, "Теннис");
  await putInGroup(user.id, boris.id, "Друзья");
  await putInGroup(user.id, vera.id, "Теннис");
  return { anna, boris, vera, gleb };
}

describe("Метки групп в строке списка", () => {
  it("Метки видны", async () => {
    await fourPeople();

    const result = await list();

    const byName = Object.fromEntries(result.items.map((item) => [item.name, item.groups.map((group) => group.name)]));
    // By the alphabet, and nothing for a person without groups
    expect(byName).toEqual({
      "Анна Смирнова": ["Друзья", "Теннис"],
      "Борис Медведев": ["Друзья"],
      "Вера Николаева": ["Теннис"],
      "Глеб Фёдоров": [],
    });
  });
});

describe("Фильтр по группам в списке", () => {
  it("Одна группа", async () => {
    await fourPeople();

    expect(names(await list(await selected("Теннис")))).toEqual(["Анна Смирнова", "Вера Николаева"]);
  });

  it("Две группы — во всех сразу", async () => {
    await fourPeople();

    const result = await list(await selected("Друзья", "Теннис"));

    // Анна is in both; Борис only in "Друзья", Вера only in "Теннис"
    expect(names(result)).toEqual(["Анна Смирнова"]);
  });

  it("Без группы", async () => {
    await fourPeople();

    expect(names(await list({ mode: "none" }))).toEqual(["Глеб Фёдоров"]);
  });

  it("Фильтр и поиск", async () => {
    const { anna } = await fourPeople();
    const otherAnna = await addContact(user.id, "Анна Орлова");
    await putInGroup(user.id, otherAnna.id, "Семья");
    expect(anna.name).toBe("Анна Смирнова");

    const result = await list(await selected("Друзья"), "Анна");

    // Only the Annas who are in "Друзья"
    expect(names(result)).toEqual(["Анна Смирнова"]);
  });

  it("Счётчик при фильтре", async () => {
    await fourPeople();
    for (const name of ["Дмитрий", "Егор", "Жанна", "Зоя"]) await addContact(user.id, name);

    const result = await list(await selected("Теннис"));

    // Two people in "Теннис" out of eight contacts
    expect(result.matched).toBe(2);
    expect(result.total).toBe(8);
    expect(result.pageCount).toBe(1);
  });

  it("Никого во всех выбранных группах", async () => {
    await fourPeople();

    const result = await list(await selected("Семья", "Аналитики"));

    expect(result.items).toEqual([]);
    expect(result.matched).toBe(0);
    expect(result.total).toBe(4);
  });

  it("Страницы считаются по отфильтрованным людям", async () => {
    for (let i = 1; i <= 12; i += 1) {
      const contact = await addContact(user.id, `Человек ${String(i).padStart(2, "0")}`);
      if (i <= 11) await putInGroup(user.id, contact.id, "Семья");
    }

    const second = await list(await selected("Семья"), "", 2, 10);

    expect(second.matched).toBe(11);
    expect(second.pageCount).toBe(2);
    expect(names(second)).toEqual(["Человек 11"]);
  });

  it("Снять группу из карточки", async () => {
    const { boris } = await fourPeople();
    const friends = await selected("Друзья");
    expect(names(await list(friends))).toContain("Борис Медведев");

    await setContactGroup(boris.id, friends.mode === "groups" ? friends.ids[0] : "", false);

    // He is no longer in the filter by "Друзья" and now has no groups at all
    expect(names(await list(friends))).toEqual(["Анна Смирнова"]);
    expect(names(await list({ mode: "none" }))).toContain("Борис Медведев");
  });
});
