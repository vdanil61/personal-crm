import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { contacts } from "@/db/schema";

describe("Пять готовых групп", () => {
  it("Группы после выкатки", async () => {
    const result = await getDb().execute<{ name: string; people: number }>(sql`
      select g.name, count(cg.contact_id)::int as people
      from groups g
      left join contact_groups cg on cg.group_id = g.id
      group by g.id, g.name
      order by g.name collate "ru-x-icu"
    `);

    expect(result.rows).toEqual([
      { name: "Аналитики", people: 0 },
      { name: "Друзья", people: 0 },
      { name: "Знакомые", people: 0 },
      { name: "Семья", people: 0 },
      { name: "Теннис", people: 0 },
    ]);
  });

  it("Старые контакты без групп", async () => {
    const db = getDb();
    // A contact as it was before the feature: nothing but the contact row itself
    const [contact] = await db.insert(contacts).values({ name: "Анна Смирнова" }).returning({ id: contacts.id });

    const result = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from contact_groups where contact_id = ${contact.id}`,
    );

    expect(result.rows[0].total).toBe(0);
  });
});
