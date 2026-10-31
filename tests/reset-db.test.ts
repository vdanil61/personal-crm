import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { contacts } from "@/db/schema";

// Both tests do the same on purpose: the second one proves that the contact
// added by the first one is gone, because tables are emptied before each test.
describe("Очистка базы перед тестом", () => {
  async function addContactAndCount() {
    const db = getDb();
    await db.insert(contacts).values({ name: "Анна Смирнова" });
    const result = await db.execute<{ total: number }>(sql`select count(*)::int as total from contacts`);
    return result.rows[0].total;
  }

  it("первый тест видит один контакт", async () => {
    expect(await addContactAndCount()).toBe(1);
  });

  it("второй тест тоже видит один контакт", async () => {
    expect(await addContactAndCount()).toBe(1);
  });
});
