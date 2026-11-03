import { beforeEach, describe, expect, it } from "vitest";

import { listGroups } from "@/lib/groups";

import { addContact, addGroup, putInGroup } from "./support/factories";
import { type TestUser, signInWithGroups } from "./support/auth";
import { testEmail } from "./support/mailpit";

let user: TestUser;

beforeEach(async () => {
  user = await signInWithGroups(testEmail("owner"));
});

describe("Страница «Группы»: список", () => {
  it("Открыть страницу групп", async () => {
    // Lower case on purpose: the order is by the Russian alphabet, case does not matter
    await addGroup(user.id, "работа");
    for (const name of ["Анна", "Борис", "Вера"]) {
      await putInGroup(user.id, (await addContact(user.id, name)).id, "Теннис");
    }
    await putInGroup(user.id, (await addContact(user.id, "Глеб")).id, "Друзья");

    const list = await listGroups(user.id);

    expect(list.map(({ name, peopleCount }) => ({ name, peopleCount }))).toEqual([
      { name: "Аналитики", peopleCount: 0 },
      { name: "Друзья", peopleCount: 1 },
      { name: "Знакомые", peopleCount: 0 },
      { name: "работа", peopleCount: 0 },
      { name: "Семья", peopleCount: 0 },
      { name: "Теннис", peopleCount: 3 },
    ]);
  });

  it("Число людей меняется", async () => {
    const tennisPeople = async () => (await listGroups(user.id)).find((group) => group.name === "Теннис")?.peopleCount;
    expect(await tennisPeople()).toBe(0);

    await putInGroup(user.id, (await addContact(user.id, "Анна")).id, "Теннис");

    expect(await tennisPeople()).toBe(1);
  });
});
