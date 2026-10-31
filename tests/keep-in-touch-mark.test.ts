import { describe, expect, it } from "vitest";

import { addNote, deleteContact, markContacted, restoreContact } from "@/app/actions";
import { getContact, listNotes, listOverdueContacts } from "@/lib/contacts";
import type { ContactSnapshot } from "@/lib/validation";

import { addContact, addNote as addOldNote } from "./support/factories";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// The last contact was a note 200 days ago: overdue for any frequency but a year
async function overdueWithNote(name: string, frequency: "week" | "month" | "quarter" = "month") {
  const contact = await addContact(name, { contactFrequency: frequency, createdAt: daysAgo(400) });
  await addOldNote(contact.id, daysAgo(200));
  return contact;
}

const overdueNames = async () => (await listOverdueContacts()).map((c) => c.name);

async function deleteAndKeepSnapshot(contactId: string): Promise<ContactSnapshot> {
  const result = await deleteContact(contactId);
  if (result.status !== "success") throw new Error(`Test setup: delete failed: ${result.message}`);
  return result.snapshot;
}

describe("Заметка сбрасывает срок", () => {
  it("Написал заметку — человек ушёл из блока", async () => {
    const anna = await overdueWithNote("Анна Смирнова");
    await overdueWithNote("Борис Медведев");
    expect(await overdueNames()).toEqual(["Анна Смирнова", "Борис Медведев"]);

    const formData = new FormData();
    formData.set("body", "Созвонились, договорились встретиться");
    expect(await addNote(anna.id, { status: "idle" }, formData)).toMatchObject({ status: "success" });

    // One less in the block
    expect(await overdueNames()).toEqual(["Борис Медведев"]);
  });
});

describe("Отметка «Связался» в блоке", () => {
  it("Отметил из блока", async () => {
    const anna = await overdueWithNote("Анна Смирнова");
    await overdueWithNote("Борис Медведев");

    expect(await markContacted(anna.id)).toEqual({ status: "success" });

    expect(await overdueNames()).toEqual(["Борис Медведев"]);
  });

  it("Заметка не создаётся", async () => {
    const anna = await overdueWithNote("Анна Смирнова");

    await markContacted(anna.id);

    expect(await listNotes(anna.id)).toHaveLength(1);
  });

  it("Отметка сохраняется", async () => {
    const anna = await overdueWithNote("Анна Смирнова");
    const before = Date.now();

    await markContacted(anna.id);

    // Kept in the database, so any browser gets the same block
    const markedAt = (await getContact(anna.id))?.lastContactedAt;
    expect(markedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(await overdueNames()).toEqual([]);
  });
});

describe("Отмена удаления возвращает частоту и отметку", () => {
  it("Удалил и вернул", async () => {
    const anna = await overdueWithNote("Анна Смирнова", "quarter");
    const snapshot = await deleteAndKeepSnapshot(anna.id);
    expect(await overdueNames()).toEqual([]);

    expect(await restoreContact(snapshot)).toEqual({ status: "success" });

    expect((await getContact(anna.id))?.contactFrequency).toBe("quarter");
    // It was in the block, so it is there again
    expect(await overdueNames()).toEqual(["Анна Смирнова"]);
  });

  it("Отмеченный контакт после отмены удаления", async () => {
    const anna = await overdueWithNote("Анна Смирнова");
    await markContacted(anna.id);
    const markedAt = (await getContact(anna.id))?.lastContactedAt;
    const snapshot = await deleteAndKeepSnapshot(anna.id);

    expect(await restoreContact(snapshot)).toEqual({ status: "success" });

    expect((await getContact(anna.id))?.lastContactedAt).toEqual(markedAt);
    expect(await overdueNames()).toEqual([]);
  });
});
