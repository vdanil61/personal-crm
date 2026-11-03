import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { deleteGroup, restoreGroup } from "@/app/actions";
import { getDb } from "@/db";
import { contacts, groups } from "@/db/schema";
import { listContactGroups, listGroups } from "@/lib/groups";
import type { GroupSnapshot } from "@/lib/validation";

import { addContact, addGroup, findGroupId, putInGroup } from "./support/factories";
import { type TestUser, signInWithGroups } from "./support/auth";
import { testEmail } from "./support/mailpit";

let user: TestUser;

beforeEach(async () => {
  user = await signInWithGroups(testEmail("owner"));
});

const groupNames = async () => (await listGroups(user.id)).map((group) => group.name);
const tennis = async () => (await listGroups(user.id)).find((group) => group.name === "Теннис");

// "Теннис" with three people, as in the scenarios
async function tennisWithThreePeople() {
  const people = [];
  for (const name of ["Анна", "Борис", "Вера"]) {
    const contact = await addContact(user.id, name);
    await putInGroup(user.id, contact.id, "Теннис");
    people.push(contact);
  }
  return people;
}

async function deleteTennis(): Promise<GroupSnapshot> {
  const result = await deleteGroup(await findGroupId(user.id, "Теннис"));
  if (result.status !== "success") throw new Error(`Test setup: delete failed: ${result.message}`);
  return result.snapshot;
}

describe("Удалить группу", () => {
  it("Удалил группу с людьми", async () => {
    const people = await tennisWithThreePeople();

    const result = await deleteGroup(await findGroupId(user.id, "Теннис"));

    expect(result).toMatchObject({ status: "success" });
    // Gone from the list (and so from the filter and the contact form), the people are still here
    expect(await groupNames()).toEqual(["Аналитики", "Друзья", "Знакомые", "Семья"]);
    expect(await getDb().select({ id: contacts.id }).from(contacts)).toHaveLength(3);
    for (const person of people) {
      expect(await listContactGroups(user.id, person.id)).toEqual([]);
    }
  });

  it("Группа уже удалена в другой вкладке", async () => {
    const groupId = await findGroupId(user.id, "Теннис");
    await getDb().delete(groups).where(eq(groups.id, groupId));

    const result = await deleteGroup(groupId);

    expect(result).toEqual({ status: "error", message: "Эта группа больше не существует." });
  });
});

describe("Отмена удаления группы", () => {
  it("Удалил и вернул группу", async () => {
    const people = await tennisWithThreePeople();
    const groupId = await findGroupId(user.id, "Теннис");
    const snapshot = await deleteTennis();

    const result = await restoreGroup(snapshot);

    expect(result).toEqual({ status: "success" });
    // The same group (same id) with the same three people
    expect(await tennis()).toMatchObject({ id: groupId, peopleCount: 3 });
    for (const person of people) {
      expect(await listContactGroups(user.id, person.id)).toEqual([{ id: groupId, name: "Теннис" }]);
    }
  });

  it("Повторное «Отменить» ничего не ломает", async () => {
    await tennisWithThreePeople();
    const snapshot = await deleteTennis();

    expect(await restoreGroup(snapshot)).toEqual({ status: "success" });
    expect(await restoreGroup(snapshot)).toEqual({ status: "success" });

    expect(await groupNames()).toEqual(["Аналитики", "Друзья", "Знакомые", "Семья", "Теннис"]);
    expect(await tennis()).toMatchObject({ peopleCount: 3 });
  });

  it("Контакт удалён до отмены — возвращаются остальные", async () => {
    const [anna] = await tennisWithThreePeople();
    const snapshot = await deleteTennis();
    await getDb().delete(contacts).where(eq(contacts.id, anna.id));

    const result = await restoreGroup(snapshot);

    expect(result).toEqual({ status: "success" });
    expect(await tennis()).toMatchObject({ peopleCount: 2 });
  });

  it("За это время создали группу с тем же названием — понятная ошибка", async () => {
    await tennisWithThreePeople();
    const snapshot = await deleteTennis();
    const newcomer = await addGroup(user.id, "теннис");

    const result = await restoreGroup(snapshot);

    expect(result).toEqual({
      status: "error",
      message: "Не удалось вернуть группу: группа «Теннис» уже есть.",
    });
    // The new group stays as it was; the old one did not come back
    expect((await listGroups(user.id)).filter((group) => group.name.toLowerCase() === "теннис")).toEqual([
      { id: newcomer.id, name: "теннис", peopleCount: 0 },
    ]);
  });
});
