import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { applyMigrations } from "@/db/apply-migrations";

import { getMaintenanceDatabaseUrl, getTestDatabaseName, getTestDatabaseUrl } from "./support/test-db-url";

// The deploy of the login feature on a copy of the real situation: a database made by the migrations
// up to 0003, filled with the data of the owner, then all the migrations at once.
// It runs on its own database `<name>_test_migration`, recreated for every test.

const SUITE = "test_migration";
const LAST_OLD_MIGRATION = "0003_default_groups";

type Journal = { entries: { tag: string }[] };

// The migrations as they were before the login feature: the same files, a shorter journal
function copyOldMigrations(): string {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as Journal;
  const last = journal.entries.findIndex((entry) => entry.tag === LAST_OLD_MIGRATION);
  const entries = journal.entries.slice(0, last + 1);

  const folder = mkdtempSync(join(tmpdir(), "old-migrations-"));
  mkdirSync(join(folder, "meta"));
  writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  for (const { tag } of entries) {
    writeFileSync(join(folder, `${tag}.sql`), readFileSync(`drizzle/${tag}.sql`));
  }
  return folder;
}

async function recreateDatabase() {
  const name = getTestDatabaseName(SUITE).replaceAll('"', '""');
  const pool = new Pool({ connectionString: getMaintenanceDatabaseUrl() });
  try {
    await pool.query(`drop database if exists "${name}" with (force)`);
    await pool.query(`create database "${name}"`);
  } finally {
    await pool.end();
  }
}

// What the owner has before the deploy: people, notes, frequencies, "Связался" marks, groups
async function fillOldDatabase(pool: Pool) {
  const people = await pool.query<{ id: string; name: string }>(`
    insert into contacts (name, about, phone, contact_frequency, last_contacted_at) values
      ('Анна Смирнова', 'Подруга по университету', '+7 900 123-45-67', 'month', now() - interval '40 days'),
      ('Борис Ковалёв', 'Тренер по теннису', null, 'week', null),
      ('Вера Петрова', null, null, null, null)
    returning id, name
  `);
  const id = (name: string) => people.rows.find((row) => row.name === name)!.id;

  await pool.query(`insert into groups (name) values ('Коллеги')`);
  await pool.query(
    `insert into notes (contact_id, body) values ($1, 'Созвонились'), ($1, 'Обсудили отпуск'), ($2, 'Игра в субботу')`,
    [id("Анна Смирнова"), id("Борис Ковалёв")],
  );
  await pool.query(
    `insert into contact_groups (contact_id, group_id)
     select $1::uuid, id from groups where name in ('Друзья', 'Теннис')
     union all select $2::uuid, id from groups where name = 'Друзья'
     union all select $2::uuid, id from groups where name = 'Коллеги'`,
    [id("Анна Смирнова"), id("Борис Ковалёв")],
  );
}

// Everything the owner can see, without the new owner column, so before and after can be compared
async function readEverything(pool: Pool) {
  const read = async (query: string) => (await pool.query(query)).rows;
  return {
    contacts: await read(`select id, name, about, how_we_met, phone, email, created_at, updated_at,
                                 contact_frequency, last_contacted_at from contacts order by id`),
    notes: await read(`select id, contact_id, body, created_at from notes order by id`),
    groups: await read(`select id, name, created_at from groups order by id`),
    links: await read(`select contact_id, group_id from contact_groups order by contact_id, group_id`),
  };
}

async function peopleInGroups(pool: Pool, ownerOnly: boolean) {
  const result = await pool.query<{ name: string; people: number }>(`
    select g.name, count(cg.contact_id)::int as people
    from groups g
    ${ownerOnly ? "join users u on u.id = g.user_id" : ""}
    left join contact_groups cg on cg.group_id = g.id
    group by g.id, g.name
    order by g.name collate "ru-x-icu"
  `);
  return result.rows;
}

let pool: Pool;

beforeEach(async () => {
  await pool?.end();
  await recreateDatabase();
  await applyMigrations(getTestDatabaseUrl(SUITE), undefined, copyOldMigrations());
  pool = new Pool({ connectionString: getTestDatabaseUrl(SUITE) });
});

afterAll(async () => {
  await pool?.end();
});

const migrateEverything = (ownerEmail?: string) => applyMigrations(getTestDatabaseUrl(SUITE), ownerEmail);

describe("Группы после выкатки", () => {
  it("Группы после выкатки", async () => {
    await migrateEverything("owner@example.com");

    expect(await peopleInGroups(pool, true)).toEqual([
      { name: "Аналитики", people: 0 },
      { name: "Друзья", people: 0 },
      { name: "Знакомые", people: 0 },
      { name: "Семья", people: 0 },
      { name: "Теннис", people: 0 },
    ]);
  });

  it("Старые контакты без групп", async () => {
    await fillOldDatabase(pool);

    await migrateEverything("owner@example.com");

    const withoutGroups = await pool.query(`
      select c.name from contacts c
      where not exists (select 1 from contact_groups cg where cg.contact_id = c.id)
    `);
    expect(withoutGroups.rows).toEqual([{ name: "Вера Петрова" }]);
  });

  it("Группы владельца после выкатки входа", async () => {
    await fillOldDatabase(pool);
    const before = await peopleInGroups(pool, false);

    await migrateEverything("owner@example.com");

    expect(await peopleInGroups(pool, true)).toEqual(before);
    expect(before).toContainEqual({ name: "Друзья", people: 2 });
    expect(before).toContainEqual({ name: "Коллеги", people: 1 });
  });
});

describe("Существующие данные — владельцу", () => {
  it("Мои данные после выкатки", async () => {
    await fillOldDatabase(pool);
    const before = await readEverything(pool);

    await migrateEverything("owner@example.com");

    const owner = await pool.query<{ id: string; email: string; email_verified: boolean }>(
      `select id, email, email_verified from users`,
    );
    expect(owner.rows).toHaveLength(1);
    expect(owner.rows[0]).toMatchObject({ email: "owner@example.com", email_verified: true });

    // Every contact and every group is the owner's, and nothing else changed
    const strangers = await pool.query(
      `select 1 from contacts where user_id is distinct from $1
       union all select 1 from groups where user_id is distinct from $1`,
      [owner.rows[0].id],
    );
    expect(strangers.rows).toHaveLength(0);
    expect(await readEverything(pool)).toEqual(before);
    expect(before.contacts).toHaveLength(3);
    expect(before.notes).toHaveLength(3);
    expect(before.groups).toHaveLength(6);
    expect(before.links).toHaveLength(4);

    // From now on a contact and a group cannot exist without an owner
    const required = await pool.query<{ table_name: string; is_nullable: string }>(
      `select table_name, is_nullable from information_schema.columns
       where column_name = 'user_id' and table_name in ('contacts', 'groups')`,
    );
    expect(required.rows).toHaveLength(2);
    expect(required.rows.every((row) => row.is_nullable === "NO")).toBe(true);
  });

  it("Почта владельца с большими буквами", async () => {
    await fillOldDatabase(pool);

    await migrateEverything("  V.Danil903@Gmail.com ");

    const owner = await pool.query(`select email from users`);
    expect(owner.rows).toEqual([{ email: "v.danil903@gmail.com" }]);
    const owned = await pool.query(
      `select count(*)::int as total from contacts c join users u on u.id = c.user_id where u.email = $1`,
      ["v.danil903@gmail.com"],
    );
    expect(owned.rows[0].total).toBe(3);
  });
});

describe("Без почты владельца выкатка не идёт", () => {
  it("Забыл настройку", async () => {
    await fillOldDatabase(pool);
    const before = await readEverything(pool);

    // Not set at all, and set to nothing but spaces
    for (const ownerEmail of [undefined, "   "]) {
      await expect(migrateEverything(ownerEmail)).rejects.toThrow(/OWNER_EMAIL/);
    }

    // The database is exactly as it was: still on 0003, the same data, no owner column
    const applied = await pool.query<{ total: number }>(
      `select count(*)::int as total from drizzle.__drizzle_migrations`,
    );
    expect(applied.rows[0].total).toBe(4);
    const newThings = await pool.query(`
      select to_regclass('public.users') as users,
             (select count(*) from information_schema.columns
              where table_name = 'contacts' and column_name = 'user_id')::int as owner_columns
    `);
    expect(newThings.rows[0]).toEqual({ users: null, owner_columns: 0 });
    expect(await readEverything(pool)).toEqual(before);
  });
});
