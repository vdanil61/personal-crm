import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { deleteContact, restoreContact } from "@/app/actions";
import { getDb } from "@/db";
import { groups } from "@/db/schema";
import { listContactGroups } from "@/lib/groups";
import type { ContactSnapshot } from "@/lib/validation";

import { addContact, findGroupId, putInGroup } from "./support/factories";
import { type TestUser, signInWithGroups } from "./support/auth";
import { testEmail } from "./support/mailpit";

let user: TestUser;

beforeEach(async () => {
  user = await signInWithGroups(testEmail("owner"));
});

async function groupNamesOf(contactId: string) {
  return (await listContactGroups(user.id, contactId)).map((group) => group.name);
}

async function deleteAndKeepSnapshot(contactId: string): Promise<ContactSnapshot> {
  const result = await deleteContact(contactId);
  if (result.status !== "success") throw new Error(`Test setup: delete failed: ${result.message}`);
  return result.snapshot;
}

async function contactInTennisAndFriends() {
  const contact = await addContact(user.id, "Анна Смирнова");
  await putInGroup(user.id, contact.id, "Друзья");
  await putInGroup(user.id, contact.id, "Теннис");
  return contact;
}

describe("Отмена удаления контакта возвращает группы", () => {
  it("Удалил контакт и вернул", async () => {
    const contact = await contactInTennisAndFriends();
    const snapshot = await deleteAndKeepSnapshot(contact.id);
    expect([...snapshot.groupIds].sort()).toEqual(
      [await findGroupId(user.id, "Друзья"), await findGroupId(user.id, "Теннис")].sort(),
    );

    const result = await restoreContact(snapshot);

    expect(result).toEqual({ status: "success" });
    expect(await groupNamesOf(contact.id)).toEqual(["Друзья", "Теннис"]);
  });

  it("Группу удалили, пока контакт был удалён", async () => {
    const contact = await contactInTennisAndFriends();
    const snapshot = await deleteAndKeepSnapshot(contact.id);
    await getDb()
      .delete(groups)
      .where(eq(groups.id, await findGroupId(user.id, "Теннис")));

    const result = await restoreContact(snapshot);

    // No error, and no "Теннис" in the restored contact
    expect(result).toEqual({ status: "success" });
    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
  });

  it("Старый снимок без групп возвращается без групп", async () => {
    const contact = await addContact(user.id, "Анна Смирнова");
    const snapshot = await deleteAndKeepSnapshot(contact.id);
    // A snapshot made by the version of the app that had no groups yet
    const oldSnapshot = { contact: snapshot.contact, notes: snapshot.notes };

    const result = await restoreContact(oldSnapshot as ContactSnapshot);

    expect(result).toEqual({ status: "success" });
    expect(await groupNamesOf(contact.id)).toEqual([]);
  });

  it("Повторное «Отменить» ничего не ломает", async () => {
    const contact = await contactInTennisAndFriends();
    const snapshot = await deleteAndKeepSnapshot(contact.id);

    expect(await restoreContact(snapshot)).toEqual({ status: "success" });
    expect(await restoreContact(snapshot)).toEqual({ status: "success" });

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья", "Теннис"]);
  });
});
