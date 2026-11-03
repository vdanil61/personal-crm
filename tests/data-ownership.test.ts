import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addNote as addNoteAction,
  createContact,
  createGroup,
  deleteContact,
  deleteGroup,
  markContacted,
  renameGroup,
  restoreContact,
  restoreGroup,
  setContactGroup,
  updateContact,
} from "@/app/actions";
import { getDb } from "@/db";
import { contactGroups, contacts, groups, notes } from "@/db/schema";
import { getContact, listContactsPage, listNotes, listOverdueContacts } from "@/lib/contacts";
import { ALL_GROUPS } from "@/lib/group-filter";
import { listContactGroups, listGroups, resolveGroupFilter } from "@/lib/groups";

import { type TestUser, signInAs } from "./support/auth";
import { addContact, addGroup, addNote, addUser, putInGroup } from "./support/factories";
import { testEmail } from "./support/mailpit";

// A is a user who owns data; B is the one signed in on this "device". A is not signed in here:
// B's requests must not reach A's records, whatever ids they carry.
let a: TestUser;
let b: TestUser;

beforeEach(async () => {
  a = await addUser(testEmail("a"));
  b = await signInAs(testEmail("b"));
});

const idle = { status: "idle" } as const;
const CONTACT_GONE = "Этот контакт больше не существует.";
const GROUP_GONE = "Эта группа больше не существует.";
const DAY = 24 * 60 * 60 * 1000;

const form = (fields: Record<string, string>, groupIds: string[] = []) => {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  for (const id of groupIds) formData.append("groupIds", id);
  return formData;
};

const contactRow = async (id: string) => (await getDb().select().from(contacts).where(eq(contacts.id, id)))[0];
const groupRow = async (id: string) => (await getDb().select().from(groups).where(eq(groups.id, id)))[0];
const linksOf = async (groupId: string) =>
  getDb().select().from(contactGroups).where(eq(contactGroups.groupId, groupId));

describe("Только свои контакты в списке, поиске и счётчике", () => {
  it("Чужого нет в списке", async () => {
    await addContact(a.id, "Анна Смирнова");
    await addContact(b.id, "Борис Медведев");

    const list = await listContactsPage(b.id, "", 1, 50);

    expect(list.items.map((item) => item.name)).toEqual(["Борис Медведев"]);
    // The counter counts only B's contacts
    expect(list.total).toBe(1);
  });

  it("Чужого нет в поиске", async () => {
    await addContact(a.id, "Анна Смирнова");

    const list = await listContactsPage(b.id, "Анна", 1, 50);

    expect(list.items).toEqual([]);
    expect(list.matched).toBe(0);
    expect(list.total).toBe(0);
  });
});

describe("Только свои группы", () => {
  it("Чужих групп не видно", async () => {
    const tennis = await addGroup(a.id, "Теннис");
    const annas = await addContact(a.id, "Анна Смирнова");
    await putInGroup(a.id, annas.id, "Теннис");
    const mine = await addGroup(b.id, "Друзья");
    // A has a group with the same name and people in it; B's number of people is B's own
    await addGroup(a.id, "Друзья");
    await putInGroup(a.id, annas.id, "Друзья");

    // The page "Группы", the filter, the field "Группы" of the form and the list of the card all read this
    expect(await listGroups(b.id)).toEqual([{ id: mine.id, name: "Друзья", peopleCount: 0 }]);
    expect(await listGroups(a.id)).toContainEqual({ id: tennis.id, name: "Теннис", peopleCount: 1 });

    const bobs = await addContact(b.id, "Борис Медведев");
    expect(await listContactGroups(b.id, bobs.id)).toEqual([]);
  });

  it("Новый пользователь без групп", async () => {
    await addGroup(a.id, "Друзья");

    expect(await listGroups(b.id)).toEqual([]);
    const list = await listContactsPage(b.id, "", 1, 50);
    expect(list.total).toBe(0);
    expect(await listOverdueContacts(b.id)).toEqual([]);
  });

  it("Такая же группа у другого пользователя", async () => {
    const aFriends = await addGroup(a.id, "Друзья");
    for (const name of ["Анна", "Вера", "Глеб"]) {
      const contact = await addContact(a.id, name);
      await putInGroup(a.id, contact.id, "Друзья");
    }

    const result = await createGroup(idle, form({ name: "Друзья" }));

    expect(result).toMatchObject({ status: "success", name: "Друзья" });
    expect(await listGroups(b.id)).toEqual([expect.objectContaining({ name: "Друзья", peopleCount: 0 })]);
    expect(await listGroups(a.id)).toEqual([{ id: aFriends.id, name: "Друзья", peopleCount: 3 }]);
    // Within one user the name is still taken
    expect(await createGroup(idle, form({ name: "друзья" }))).toMatchObject({ status: "error" });
  });
});

describe("Только свои в блоке «Пора связаться»", () => {
  it("Чужой просроченный не виден", async () => {
    await addContact(a.id, "Анна Смирнова", {
      contactFrequency: "week",
      createdAt: new Date(Date.now() - 100 * DAY),
    });

    expect(await listOverdueContacts(a.id)).toHaveLength(1);
    expect(await listOverdueContacts(b.id)).toEqual([]);
  });
});

describe("Чужой контакт по ссылке не найден", () => {
  it("Чужой контакт по прямой ссылке", async () => {
    const anna = await addContact(a.id, "Анна Смирнова");
    await addNote(anna.id, new Date());

    // The page opens the contact and its notes by the id from the address: both must find nothing
    expect(await getContact(a.id, anna.id)).toMatchObject({ name: "Анна Смирнова" });
    expect(await getContact(b.id, anna.id)).toBeNull();
    expect(await listNotes(b.id, anna.id)).toEqual([]);
    expect(await listContactGroups(b.id, anna.id)).toEqual([]);
    // Nothing differs from a contact nobody has
    expect(await getContact(b.id, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("Чужая группа в адресе фильтра не действует", () => {
  it("Ссылка с фильтром по чужой группе", async () => {
    const tennis = await addGroup(a.id, "Теннис");
    const annas = await addContact(a.id, "Анна Смирнова");
    await putInGroup(a.id, annas.id, "Теннис");
    await addContact(b.id, "Борис Медведев");

    const filter = await resolveGroupFilter(b.id, tennis.id);
    const list = await listContactsPage(b.id, "", 1, 50, filter);

    expect(filter).toEqual(ALL_GROUPS);
    expect(list.items.map((item) => item.name)).toEqual(["Борис Медведев"]);
  });
});

describe("Чужое не меняется прямым запросом к серверу", () => {
  it("Заметка из старой вкладки", async () => {
    const anna = await addContact(a.id, "Анна Смирнова");

    const result = await addNoteAction(anna.id, idle, form({ body: "Созвонились" }));

    expect(result).toEqual({ status: "error", body: "Созвонились", message: CONTACT_GONE });
    expect(await getDb().select().from(notes).where(eq(notes.contactId, anna.id))).toEqual([]);
  });

  it("Группа из старой вкладки", async () => {
    const tennis = await addGroup(a.id, "Теннис");

    const result = await renameGroup(tennis.id, idle, form({ name: "Корт" }));

    expect(result).toMatchObject({ status: "error", message: GROUP_GONE });
    expect((await groupRow(tennis.id)).name).toBe("Теннис");
  });

  it("Изменить чужой контакт", async () => {
    const anna = await addContact(a.id, "Анна Смирнова");

    const result = await updateContact(anna.id, idle, form({ name: "Взломана" }));

    expect(result).toMatchObject({ status: "error", message: CONTACT_GONE });
    expect(await contactRow(anna.id)).toMatchObject({ name: "Анна Смирнова", userId: a.id });
  });

  it("Удалить чужой контакт", async () => {
    const anna = await addContact(a.id, "Анна Смирнова");
    await addNote(anna.id, new Date());

    const result = await deleteContact(anna.id);

    expect(result).toEqual({ status: "error", message: CONTACT_GONE });
    expect(await contactRow(anna.id)).toBeDefined();
    expect(await getDb().select().from(notes).where(eq(notes.contactId, anna.id))).toHaveLength(1);
  });

  it("Вернуть контакт с номером чужого", async () => {
    const anna = await addContact(a.id, "Анна Смирнова");
    const snapshot = {
      contact: { ...anna, name: "Подмена" },
      notes: [{ id: "00000000-0000-4000-8000-000000000001", body: "Чужая заметка", createdAt: new Date() }],
      groupIds: [],
    };

    const result = await restoreContact(snapshot);

    expect(result).toEqual({ status: "success" });
    expect(await contactRow(anna.id)).toMatchObject({ name: "Анна Смирнова", userId: a.id });
    expect(await getDb().select().from(notes).where(eq(notes.contactId, anna.id))).toEqual([]);
    expect(await getDb().select().from(contacts).where(eq(contacts.userId, b.id))).toEqual([]);
  });

  it("Отметить «Связался» у чужого контакта", async () => {
    const anna = await addContact(a.id, "Анна Смирнова", { contactFrequency: "week" });

    const result = await markContacted(anna.id);

    expect(result).toEqual({ status: "error", message: CONTACT_GONE });
    expect((await contactRow(anna.id)).lastContactedAt).toBeNull();
  });

  it("Положить чужой контакт в свою группу и свой — в чужую", async () => {
    const annas = await addContact(a.id, "Анна Смирнова");
    const aGroup = await addGroup(a.id, "Теннис");
    const bContact = await addContact(b.id, "Борис Медведев");
    const bGroup = await addGroup(b.id, "Друзья");

    expect(await setContactGroup(annas.id, bGroup.id, true)).toEqual({ status: "error", message: CONTACT_GONE });
    expect(await setContactGroup(bContact.id, aGroup.id, true)).toEqual({ status: "error", message: GROUP_GONE });
    expect(await setContactGroup(annas.id, aGroup.id, true)).toEqual({ status: "error", message: CONTACT_GONE });
    expect(await getDb().select().from(contactGroups)).toEqual([]);

    // Taking out works the same: a stranger's link is not touched
    await putInGroup(a.id, annas.id, "Теннис");
    await setContactGroup(annas.id, aGroup.id, false);
    expect(await linksOf(aGroup.id)).toHaveLength(1);
  });

  it("Переименовать и удалить чужую группу", async () => {
    const tennis = await addGroup(a.id, "Теннис");
    const annas = await addContact(a.id, "Анна Смирнова");
    await putInGroup(a.id, annas.id, "Теннис");

    expect(await renameGroup(tennis.id, idle, form({ name: "Корт" }))).toMatchObject({
      status: "error",
      message: GROUP_GONE,
    });
    expect(await deleteGroup(tennis.id)).toEqual({ status: "error", message: GROUP_GONE });

    expect(await groupRow(tennis.id)).toMatchObject({ name: "Теннис", userId: a.id });
    expect(await linksOf(tennis.id)).toHaveLength(1);
  });

  it("Вернуть группу с номером чужой", async () => {
    const tennis = await addGroup(a.id, "Теннис");

    const result = await restoreGroup({ group: { ...tennis, name: "Подмена" }, contactIds: [] });

    expect(result).toEqual({ status: "success" });
    expect(await groupRow(tennis.id)).toMatchObject({ name: "Теннис", userId: a.id });
    expect(await getDb().select().from(groups).where(eq(groups.userId, b.id))).toEqual([]);
  });

  it("Чужие группы в форме отбрасываются", async () => {
    const aGroup = await addGroup(a.id, "Теннис");
    const bGroup = await addGroup(b.id, "Друзья");

    const created = await createContact(idle, form({ name: "Борис Медведев" }, [aGroup.id, bGroup.id]));

    if (created.status !== "success") throw new Error("Test setup: contact was not saved");
    expect((await listContactGroups(b.id, created.contactId)).map((group) => group.name)).toEqual(["Друзья"]);
    expect(await linksOf(aGroup.id)).toEqual([]);

    // The same when an existing contact is saved
    const updated = await updateContact(created.contactId, idle, form({ name: "Борис Медведев" }, [aGroup.id]));
    expect(updated).toMatchObject({ status: "success" });
    expect(await getDb().select().from(contactGroups)).toEqual([]);
  });

  it("Чужие контакты в снимке группы отбрасываются", async () => {
    const annas = await addContact(a.id, "Анна Смирнова");
    const bContact = await addContact(b.id, "Борис Медведев");
    const group = await addGroup(b.id, "Друзья");

    const result = await restoreGroup({
      group: { id: "00000000-0000-4000-8000-000000000002", name: "Друзья 2", createdAt: group.createdAt },
      contactIds: [annas.id, bContact.id],
    });

    expect(result).toEqual({ status: "success" });
    const restored = await getDb()
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.groupId, "00000000-0000-4000-8000-000000000002"));
    expect(restored.map((link) => link.contactId)).toEqual([bContact.id]);
  });

  it("Новая запись получает владельца из входа", async () => {
    const created = await createContact(idle, form({ name: "Борис Медведев" }));
    const group = await createGroup(idle, form({ name: "Друзья" }));
    if (created.status !== "success" || group.status !== "success") throw new Error("Test setup: nothing saved");
    expect(await contactRow(created.contactId)).toMatchObject({ userId: b.id });
    expect(await groupRow(group.groupId)).toMatchObject({ userId: b.id });

    // Undo of a delete puts the contact back to the same owner
    const deleted = await deleteContact(created.contactId);
    if (deleted.status !== "success") throw new Error("Test setup: delete failed");
    await restoreContact(deleted.snapshot);
    expect(await contactRow(created.contactId)).toMatchObject({ userId: b.id });
    expect(
      await getDb()
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, created.contactId), eq(contacts.userId, a.id))),
    ).toEqual([]);
  });
});
