import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createContact, updateContact } from "@/app/actions";
import { getDb } from "@/db";
import { CONTACT_FREQUENCIES, frequencyIntervals } from "@/lib/contact-frequency";
import { listOverdueContacts } from "@/lib/contacts";

import { addContact, addNote } from "./support/factories";

const idle = { status: "idle" } as const;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// The "Изменить" form with only the frequency changed
function contactForm(name: string, frequency: string) {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("contactFrequency", frequency);
  return formData;
}

async function setFrequency(contact: { id: string; name: string }, frequency: string) {
  const result = await updateContact(contact.id, idle, contactForm(contact.name, frequency));
  if (result.status !== "success") throw new Error(`Test setup: contact was not saved: ${JSON.stringify(result)}`);
}

// In the order of the block, not sorted by the test
const overdueNames = async () => (await listOverdueContacts()).map((c) => c.name);

describe("Когда пора связаться", () => {
  it("Давно не общались", async () => {
    const anna = await addContact("Анна Смирнова", { createdAt: daysAgo(400) });
    await addNote(anna.id, daysAgo(40));

    await setFrequency(anna, "month");

    expect(await overdueNames()).toEqual(["Анна Смирнова"]);
  });

  it("Недавно общались", async () => {
    // Added long ago, so only the recent note keeps the contact out of the block
    const anna = await addContact("Анна Смирнова", { contactFrequency: "week", createdAt: daysAgo(40) });
    await addNote(anna.id, daysAgo(2));

    expect(await overdueNames()).toEqual([]);
  });

  it("Ни заметок, ни отметок, контакт добавлен давно", async () => {
    const anna = await addContact("Анна Смирнова", { createdAt: daysAgo(40) });

    await setFrequency(anna, "week");

    const [inBlock] = await listOverdueContacts();
    // No time of the last contact: the block shows "ещё не связывались"
    expect(inBlock).toMatchObject({ name: "Анна Смирнова", frequency: "week", lastContactAt: null });
  });

  it("Ни заметок, ни отметок, контакт добавлен только что", async () => {
    const formData = contactForm("Анна Смирнова", "week");

    expect(await createContact(idle, formData)).toMatchObject({ status: "success" });

    expect(await overdueNames()).toEqual([]);
  });

  it("Частота не задана", async () => {
    const anna = await addContact("Анна Смирнова", { createdAt: daysAgo(400) });
    await addNote(anna.id, daysAgo(365));

    expect(await overdueNames()).toEqual([]);
  });

  it("Неделя — 7 дней", async () => {
    // A few hours either side of exactly 7 days
    await addContact("Анна Смирнова", { contactFrequency: "week", createdAt: daysAgo(7 - 1 / 8) });
    await addContact("Борис Медведев", { contactFrequency: "week", createdAt: daysAgo(7 + 1 / 8) });

    expect(await overdueNames()).toEqual(["Борис Медведев"]);
  });

  it("Месяц, квартал и год — календарные", async () => {
    // From January 31: a calendar month ends on the last day of February, not on March 2
    const periodEnds: Record<string, string> = {};
    for (const frequency of CONTACT_FREQUENCIES) {
      const result = await getDb().execute<{ end: string }>(
        sql`select to_char(timestamp '2026-01-31 12:00' + ${frequencyIntervals[frequency]}::interval, 'YYYY-MM-DD') as end`,
      );
      periodEnds[frequency] = result.rows[0].end;
    }

    expect(periodEnds).toEqual({
      week: "2026-02-07",
      month: "2026-02-28",
      quarter: "2026-04-30",
      year: "2027-01-31",
    });
  });

  it("Последнее общение — позднее из заметки и «Связался»", async () => {
    // Either one alone, if recent, keeps the contact out of the block
    const markedLater = await addContact("Анна Смирнова", {
      contactFrequency: "week",
      createdAt: daysAgo(400),
      lastContactedAt: daysAgo(2),
    });
    await addNote(markedLater.id, daysAgo(40));
    const notedLater = await addContact("Борис Медведев", {
      contactFrequency: "week",
      createdAt: daysAgo(400),
      lastContactedAt: daysAgo(40),
    });
    await addNote(notedLater.id, daysAgo(2));
    expect(await overdueNames()).toEqual([]);

    // Both long ago: the block shows the later of the two
    const earlier = daysAgo(30);
    const later = daysAgo(20);
    const vera = await addContact("Вера Николаева", {
      contactFrequency: "week",
      createdAt: daysAgo(400),
      lastContactedAt: earlier,
    });
    await addNote(vera.id, later);
    const gleb = await addContact("Глеб Фёдоров", {
      contactFrequency: "week",
      createdAt: daysAgo(400),
      lastContactedAt: later,
    });
    await addNote(gleb.id, earlier);

    expect(await listOverdueContacts()).toEqual([
      expect.objectContaining({ name: "Вера Николаева", lastContactAt: later }),
      expect.objectContaining({ name: "Глеб Фёдоров", lastContactAt: later }),
    ]);
  });

  it("Смена частоты не сбрасывает отсчёт", async () => {
    const notedAt = daysAgo(20);
    const anna = await addContact("Анна Смирнова", { contactFrequency: "year", createdAt: daysAgo(400) });
    await addNote(anna.id, notedAt);
    expect(await overdueNames()).toEqual([]);

    await setFrequency(anna, "week");

    // Counted from the note, not from the moment the frequency changed
    expect(await listOverdueContacts()).toEqual([
      expect.objectContaining({ name: "Анна Смирнова", lastContactAt: notedAt }),
    ]);
  });
});

describe("Порядок в блоке", () => {
  // Each pair is added so that the alphabet alone would give the wrong order

  it("Разная давность при одной частоте", async () => {
    const recent = await addContact("Анна Смирнова", { contactFrequency: "week", createdAt: daysAgo(400) });
    await addNote(recent.id, daysAgo(14));
    const longAgo = await addContact("Борис Медведев", { contactFrequency: "week", createdAt: daysAgo(400) });
    await addNote(longAgo.id, daysAgo(60));

    expect(await overdueNames()).toEqual(["Борис Медведев", "Анна Смирнова"]);
  });

  it("Разная частота", async () => {
    // Due 3 days ago
    const weekly = await addContact("Анна Смирнова", { contactFrequency: "week", createdAt: daysAgo(400) });
    await addNote(weekly.id, daysAgo(10));
    // Due about 2 months ago
    const monthly = await addContact("Борис Медведев", { contactFrequency: "month", createdAt: daysAgo(400) });
    await addNote(monthly.id, daysAgo(90));

    expect(await overdueNames()).toEqual(["Борис Медведев", "Анна Смирнова"]);
  });

  it("Одинаковый срок — по алфавиту", async () => {
    const addedAt = daysAgo(40);
    await addContact("Борис Медведев", { contactFrequency: "week", createdAt: addedAt });
    await addContact("Анна Смирнова", { contactFrequency: "week", createdAt: addedAt });

    expect(await overdueNames()).toEqual(["Анна Смирнова", "Борис Медведев"]);
  });
});
