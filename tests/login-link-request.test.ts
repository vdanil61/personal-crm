import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestLoginLink } from "@/app/login/actions";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth/auth";

import { visitFrom } from "./support/auth";
import { addUser } from "./support/factories";
import { countTestEmails, findEmails, testEmail } from "./support/mailpit";

const idle = { status: "idle" } as const;
const RATE_LIMITED = "Слишком часто, попробуйте через несколько минут";

const form = (email: string) => {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
};
const request = (email: string) => requestLoginLink(idle, form(email));

// Every test starts as a visitor who is not signed in
beforeEach(() => visitFrom("198.51.100.1"));

const minutesAgo = (minutes: number) =>
  getDb().execute(sql`update login_link_requests set created_at = created_at - make_interval(mins => ${minutes})`);

describe("Запрос ссылки для входа", () => {
  it("Отправил ссылку", async () => {
    const result = await request(testEmail("anna"));

    expect(result).toMatchObject({ status: "sent", email: testEmail("anna") });
    expect(await findEmails(testEmail("anna"))).toHaveLength(1);
  });

  it("Новая и знакомая почта — одно сообщение", async () => {
    await addUser(testEmail("anna"));

    const known = await request(testEmail("anna"));
    const stranger = await request(testEmail("boris"));

    // The same answer in both cases: it says nothing about who has signed in before
    expect(known).toMatchObject({ status: "sent", email: testEmail("anna") });
    expect(stranger).toMatchObject({ status: "sent", email: testEmail("boris") });
    expect(await findEmails(testEmail("anna"))).toHaveLength(1);
    expect(await findEmails(testEmail("boris"))).toHaveLength(1);
  });
});

describe("Проверка адреса почты", () => {
  it("Неверный адрес", async () => {
    const result = await request("anna@");

    expect(result).toMatchObject({ status: "error", field: "email", message: "Проверьте адрес почты" });
    expect(await countTestEmails()).toBe(0);
  });

  it("Пустая почта", async () => {
    for (const empty of ["", "   "]) {
      const result = await request(empty);

      expect(result).toMatchObject({ status: "error", field: "email", message: "Проверьте адрес почты" });
    }
    expect(await countTestEmails()).toBe(0);
  });

  it("Запрос не из формы", async () => {
    // Straight to the handler of Better Auth, as a program would do it
    const response = await getAuth().handler(
      new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: process.env.BETTER_AUTH_URL!,
          "x-real-ip": "198.51.100.2",
        },
        body: JSON.stringify({ email: "anna@" }),
      }),
    );

    expect(response.ok).toBe(false);
    expect(await countTestEmails()).toBe(0);
  });

  it("Запрос не из формы тоже считается в лимите", async () => {
    const direct = () =>
      getAuth().handler(
        new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-in/magic-link`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: process.env.BETTER_AUTH_URL!,
            "x-real-ip": "198.51.100.2",
          },
          body: JSON.stringify({ email: testEmail("anna") }),
        }),
      );

    for (let i = 0; i < 3; i += 1) expect((await direct()).ok).toBe(true);
    expect((await direct()).ok).toBe(false);
    expect(await findEmails(testEmail("anna"))).toHaveLength(3);
  });
});

describe("Почта без пробелов по краям и без учёта регистра", () => {
  it("Пробелы и большие буквы", async () => {
    const result = await request(" Anna@Vitest.Example.COM ");

    expect(result).toMatchObject({ status: "sent", email: "anna@vitest.example.com" });
    expect(await findEmails("anna@vitest.example.com")).toHaveLength(1);
  });
});

describe("Лимит писем на одну почту", () => {
  const threeEmails = async () => {
    for (let i = 0; i < 3; i += 1) expect(await request(testEmail("anna"))).toMatchObject({ status: "sent" });
  };

  it("Четвёртое письмо за 10 минут", async () => {
    // Refusals for a wrong address do not count
    await request("anna@");
    await request("");
    await threeEmails();

    const result = await request(testEmail("anna"));

    expect(result).toMatchObject({ status: "error", field: "form", message: RATE_LIMITED });
    expect(await findEmails(testEmail("anna"))).toHaveLength(3);
  });

  it("Через 10 минут снова можно", async () => {
    await threeEmails();
    await minutesAgo(11);

    const result = await request(testEmail("anna"));

    expect(result).toMatchObject({ status: "sent", email: testEmail("anna") });
    expect(await findEmails(testEmail("anna"))).toHaveLength(4);
  });

  it("Лимит одной почты не мешает другой", async () => {
    await threeEmails();
    expect(await request(testEmail("anna"))).toMatchObject({ status: "error", message: RATE_LIMITED });

    const result = await request(testEmail("boris"));

    expect(result).toMatchObject({ status: "sent", email: testEmail("boris") });
    expect(await findEmails(testEmail("boris"))).toHaveLength(1);
  });
});

describe("Лимит писем с одного адреса в интернете", () => {
  it("Одиннадцатое письмо за час", async () => {
    for (let i = 1; i <= 10; i += 1) {
      expect(await request(testEmail(`person${i}`))).toMatchObject({ status: "sent" });
    }

    const result = await request(testEmail("person11"));

    expect(result).toMatchObject({ status: "error", field: "form", message: RATE_LIMITED });
    expect(await findEmails(testEmail("person11"))).toHaveLength(0);

    // Another address on the internet is not affected
    visitFrom("198.51.100.77");
    expect(await request(testEmail("person11"))).toMatchObject({ status: "sent" });
  });
});

describe("Письмо не отправилось", () => {
  it("Почта не работает", async () => {
    const smtpUrl = process.env.SMTP_URL;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // Nothing listens on port 1
    process.env.SMTP_URL = "smtp://127.0.0.1:1";
    try {
      const result = await request(testEmail("anna"));

      expect(result).toMatchObject({
        status: "error",
        field: "form",
        message: "Не удалось отправить письмо. Попробуйте ещё раз.",
      });
    } finally {
      process.env.SMTP_URL = smtpUrl;
      log.mockRestore();
    }
  });
});

describe("Письмо со ссылкой", () => {
  it("Что в письме", async () => {
    await request(testEmail("anna"));

    const [email] = await findEmails(testEmail("anna"));

    expect(email.from.name).toBe("Личная CRM");
    // The address comes from the settings, not from the code
    expect(email.from.address).toBe(/<([^>]+)>/.exec(process.env.MAIL_FROM!)?.[1]);
    expect(email.subject).toBe("Вход в Личную CRM");
    for (const part of [email.html, email.text]) {
      expect(part).toContain("15 минут");
      expect(part).toContain("Если вы не запрашивали вход — просто проигнорируйте письмо");
      expect(part).toContain(`${process.env.BETTER_AUTH_URL}/api/auth/magic-link/verify?token=`);
    }
    expect(email.html).toMatch(/>\s*Войти\s*</);
  });
});
