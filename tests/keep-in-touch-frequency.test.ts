import { describe, expect, it } from "vitest";

import { createContact, updateContact } from "@/app/actions";
import { frequencyLabels } from "@/lib/contact-frequency";
import { getContact, listOverdueContacts } from "@/lib/contacts";

import { addContact, addNote } from "./support/factories";

const idle = { status: "idle" } as const;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// What the browser sends: "Не задано" in the select, also when it was not touched, is an empty string
function contactForm({ name = "Анна Смирнова", frequency = "" }: { name?: string; frequency?: string } = {}) {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("contactFrequency", frequency);
  return formData;
}

async function savedContactId(result: Awaited<ReturnType<typeof createContact>>) {
  if (result.status !== "success") throw new Error(`Test setup: contact was not saved: ${JSON.stringify(result)}`);
  return result.contactId;
}

// What the card shows in the "Как часто общаться" row; null is "не указано"
async function cardFrequency(contactId: string) {
  const contact = await getContact(contactId);
  if (!contact) throw new Error("Test setup: no such contact");
  return contact.contactFrequency && frequencyLabels[contact.contactFrequency];
}

const overdueNames = async () => (await listOverdueContacts()).map((c) => c.name);

describe("Частота общения задаётся в форме контакта", () => {
  it("Задать частоту при добавлении контакта", async () => {
    const result = await createContact(idle, contactForm({ frequency: "month" }));

    expect(await cardFrequency(await savedContactId(result))).toBe("раз в месяц");
  });

  it("Новый контакт без частоты", async () => {
    const result = await createContact(idle, contactForm());

    expect(await cardFrequency(await savedContactId(result))).toBeNull();
  });

  it("Поменять частоту", async () => {
    const contact = await addContact("Анна Смирнова", { contactFrequency: "month" });

    const result = await updateContact(contact.id, idle, contactForm({ frequency: "week" }));

    expect(result).toMatchObject({ status: "success" });
    expect(await cardFrequency(contact.id)).toBe("раз в неделю");
  });

  it("Убрать частоту", async () => {
    const contact = await addContact("Анна Смирнова", { contactFrequency: "month", createdAt: daysAgo(40) });
    expect(await overdueNames()).toEqual(["Анна Смирнова"]);

    const result = await updateContact(contact.id, idle, contactForm());

    expect(result).toMatchObject({ status: "success" });
    expect(await cardFrequency(contact.id)).toBeNull();
    expect(await overdueNames()).toEqual([]);
  });

  it("Старые контакты после обновления приложения", async () => {
    // Contacts as they were before the feature: added long ago, with old notes, nothing else
    const anna = await addContact("Анна Смирнова", { createdAt: daysAgo(400) });
    await addNote(anna.id, daysAgo(365));
    const boris = await addContact("Борис Медведев", { createdAt: daysAgo(100) });

    for (const contact of [anna, boris]) {
      expect(await cardFrequency(contact.id)).toBeNull();
      expect((await getContact(contact.id))?.lastContactedAt).toBeNull();
    }
    expect(await overdueNames()).toEqual([]);
  });
});
