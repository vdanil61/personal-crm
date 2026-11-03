import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { contactGroups, contacts, groups, notes, users } from "@/db/schema";
import { seedDemoData } from "@/db/seed-demo-data";
import { listContactsPage } from "@/lib/contacts";

import { addContact, addDefaultGroups, addGroup, addUser } from "./support/factories";
import { testEmail } from "./support/mailpit";

const OWNER = testEmail("owner");

const countOf = async (table: typeof contacts | typeof notes | typeof groups | typeof contactGroups) =>
  (await getDb().select({ value: count() }).from(table))[0].value;

describe("Демо-данные — владельцу", () => {
  it("Демо-данные в пустой базе", async () => {
    // A migrated database already has the owner's five groups
    const owner = await addUser(OWNER);
    await addDefaultGroups(owner.id);
    const stranger = await addUser(testEmail("b"));

    const result = await seedDemoData(getDb(), OWNER, 1000);

    expect(result).toMatchObject({ status: "seeded", contacts: 1000 });
    // The owner sees a thousand contacts with notes, some of them in groups
    expect((await listContactsPage(owner.id, "", 1, 50)).total).toBe(1000);
    expect(await countOf(notes)).toBeGreaterThan(0);
    const links = await getDb()
      .select({ ownerOfGroup: groups.userId })
      .from(contactGroups)
      .innerJoin(groups, eq(groups.id, contactGroups.groupId));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.ownerOfGroup === owner.id)).toBe(true);
    // Someone else who signs in sees nothing
    expect((await listContactsPage(stranger.id, "", 1, 50)).total).toBe(0);
  });

  it("Владельца ещё нет — он создаётся", async () => {
    const result = await seedDemoData(getDb(), `  ${OWNER.toUpperCase()} `, 5);

    expect(result).toMatchObject({ status: "seeded", contacts: 5 });
    const owners = await getDb().select().from(users);
    expect(owners).toHaveLength(1);
    expect(owners[0].email).toBe(OWNER);
    expect(await countOf(contacts)).toBe(5);
  });

  it("У владельца уже есть контакты", async () => {
    const owner = await addUser(OWNER);
    await addContact(owner.id, "Анна Смирнова");

    const result = await seedDemoData(getDb(), OWNER, 1000);

    // Nothing is added, and the command says so
    expect(result).toMatchObject({ status: "skipped", existing: 1 });
    expect(await countOf(contacts)).toBe(1);
  });

  it("Чужие данные не меняются", async () => {
    const owner = await addUser(OWNER);
    await addDefaultGroups(owner.id);
    const stranger = await addUser(testEmail("b"));
    const theirGroup = await addGroup(stranger.id, "Друзья");
    await addContact(stranger.id, "Борис Медведев");

    await seedDemoData(getDb(), OWNER, 20);

    expect((await listContactsPage(stranger.id, "", 1, 50)).total).toBe(1);
    expect(await getDb().select().from(contactGroups).where(eq(contactGroups.groupId, theirGroup.id))).toEqual([]);
    expect((await listContactsPage(owner.id, "", 1, 50)).total).toBe(20);
  });

  it("Без почты владельца понятная ошибка", async () => {
    await expect(seedDemoData(getDb(), "  ", 5)).rejects.toThrow(/OWNER_EMAIL/);
    expect(await countOf(contacts)).toBe(0);
  });
});
