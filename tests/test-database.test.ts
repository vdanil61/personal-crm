import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/db";

describe("Тестовая база", () => {
  it("база тестов пустая и миграции применены", async () => {
    const db = getDb();

    const contacts = await db.execute<{ total: number }>(sql`select count(*)::int as total from contacts`);
    const notes = await db.execute<{ total: number }>(sql`select count(*)::int as total from notes`);
    expect(contacts.rows[0].total).toBe(0);
    expect(notes.rows[0].total).toBe(0);

    // Drizzle writes one row per applied migration; the journal lists all migration files
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
    const applied = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from drizzle.__drizzle_migrations`,
    );
    expect(applied.rows[0].total).toBe(journal.entries.length);
  });
});
