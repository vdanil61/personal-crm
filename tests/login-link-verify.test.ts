import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { requestLoginLink } from "@/app/login/actions";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth/auth";

import { visitFrom } from "./support/auth";
import { findEmails, findLoginLink, testEmail } from "./support/mailpit";

const idle = { status: "idle" } as const;

// Every test starts as a visitor who is not signed in
beforeEach(() => visitFrom("198.51.100.1"));

async function requestLink(email: string): Promise<string> {
  const formData = new FormData();
  formData.set("email", email);
  const result = await requestLoginLink(idle, formData);
  if (result.status !== "sent") throw new Error(`Test setup: no link was sent: ${JSON.stringify(result)}`);
  return findLoginLink(result.email);
}

// What the browser does with the link from the email: opens it and gets sent somewhere
async function openLink(link: string) {
  const response = await getAuth().handler(new Request(link));
  return {
    status: response.status,
    // Where the browser is sent next, without the host
    goesTo: response.headers.get("location") ? new URL(response.headers.get("location")!, link).pathname : null,
    signedIn: (response.headers.get("set-cookie") ?? "").includes("session_token="),
  };
}

const rows = async (query: ReturnType<typeof sql>) => (await getDb().execute(query)).rows;

describe("Вход по ссылке", () => {
  it("Вошёл по ссылке", async () => {
    const link = await requestLink(testEmail("anna"));

    expect(await openLink(link)).toEqual({ status: 302, goesTo: "/", signedIn: true });
  });

  it("Первый вход — и есть регистрация", async () => {
    const link = await requestLink(testEmail("anna"));

    const opened = await openLink(link);

    // One user with the email, no name asked, and straight to the main page
    expect(opened).toMatchObject({ goesTo: "/", signedIn: true });
    expect(await rows(sql`select name, email, email_verified from users`)).toEqual([
      { name: "", email: testEmail("anna"), email_verified: true },
    ]);
  });
});

describe("Ссылка работает один раз и 15 минут", () => {
  it("Ссылка второй раз", async () => {
    const link = await requestLink(testEmail("anna"));
    expect(await openLink(link)).toMatchObject({ goesTo: "/", signedIn: true });

    expect(await openLink(link)).toEqual({ status: 302, goesTo: "/login/expired", signedIn: false });
  });

  it("Ссылка живёт 15 минут", async () => {
    await requestLink(testEmail("anna"));

    const [{ minutes }] = await rows(
      sql`select round(extract(epoch from (expires_at - created_at)) / 60)::int as minutes from verifications`,
    );

    expect(minutes).toBe(15);
  });

  it("Ссылка через 15 минут", async () => {
    const link = await requestLink(testEmail("anna"));
    await getDb().execute(sql`update verifications set expires_at = now() - interval '1 minute'`);

    expect(await openLink(link)).toEqual({ status: 302, goesTo: "/login/expired", signedIn: false });
    expect(await rows(sql`select 1 from users`)).toEqual([]);
  });

  it("Запросил новую — старая не работает", async () => {
    const first = await requestLink(testEmail("anna"));
    const second = await requestLink(testEmail("anna"));
    expect(await findEmails(testEmail("anna"))).toHaveLength(2);

    expect(await openLink(first)).toEqual({ status: 302, goesTo: "/login/expired", signedIn: false });
    expect(await openLink(second)).toMatchObject({ goesTo: "/", signedIn: true });
  });
});

describe("Страница «Ссылка устарела»", () => {
  it("Испорченная ссылка", async () => {
    const link = await requestLink(testEmail("anna"));
    const broken = link.replace(/token=([^&]*)/, (_, token: string) => `token=${token.slice(0, -4)}`);

    expect(await openLink(broken)).toEqual({ status: 302, goesTo: "/login/expired", signedIn: false });
    // The good link is still good: the broken one spent nothing
    expect(await openLink(link)).toMatchObject({ goesTo: "/", signedIn: true });
  });
});

describe("Почта без пробелов по краям и без учёта регистра", () => {
  it("Тот же пользователь при другом регистре", async () => {
    const first = await requestLink(testEmail("anna"));
    expect(await openLink(first)).toMatchObject({ signedIn: true });
    const [{ id }] = await rows(sql`select id from users`);

    const second = await requestLink(` ${testEmail("anna").toUpperCase()} `);
    expect(await openLink(second)).toMatchObject({ goesTo: "/", signedIn: true });

    // Still one user, and now two devices signed in as them
    expect(await rows(sql`select id from users`)).toEqual([{ id }]);
    expect(await rows(sql`select count(*)::int as total from sessions where user_id = ${id}`)).toEqual([{ total: 2 }]);
  });
});

describe("Ссылка хранится как отпечаток", () => {
  it("В базе нет самой ссылки", async () => {
    const link = await requestLink(testEmail("anna"));
    const token = new URL(link).searchParams.get("token")!;

    const found = await rows(
      sql`select 1 from verifications where identifier like ${`%${token}%`} or value like ${`%${token}%`}`,
    );

    expect(found).toEqual([]);
    expect(await rows(sql`select 1 from verifications`)).toHaveLength(1);
  });
});
