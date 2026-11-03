import { type Browser, type Page, expect, test } from "@playwright/test";

import { requestLoginLink, signIn } from "./support/auth";
import {
  addContact,
  addContacts,
  addUser,
  ageSessions,
  closeDb,
  expireSessions,
  readSessionExpiry,
  resetDb,
} from "./support/db";
import { mailbox } from "./support/mailpit";

// Login, the header, the empty list and the success criterion of specs/02-пользователи-вход.md:
// A signs in and adds a contact; B signs in and does not see it. Every sign-in goes through the real form
// and the real email, which Mailpit has caught.

test.beforeEach(resetDb);
test.afterAll(closeDb);

const ANNA = mailbox.testEmail("anna");
const BORIS = mailbox.testEmail("boris");
const NO_SUCH_CONTACT = "/contacts/00000000-0000-4000-8000-000000000000";
const DAY_SECONDS = 24 * 60 * 60;

const loginHeading = (page: Page) => page.getByRole("heading", { name: "Вход в Личную CRM" });
const contactRows = (page: Page) => page.locator("[data-contact-row]");
const header = (page: Page) => page.getByRole("banner");
const topAddButton = (page: Page) =>
  page
    .getByRole("heading", { level: 1, name: "Контакты" })
    .locator("..")
    .getByRole("button", { name: "Добавить контакт" });
const emptyBlock = (page: Page) => page.getByText("Здесь пока никого нет", { exact: true }).locator("..");

// Another browser (or a phone): shares nothing with the first one
async function inOtherBrowser(browser: Browser, work: (other: Page) => Promise<void>) {
  const context = await browser.newContext();
  try {
    await work(await context.newPage());
  } finally {
    await context.close();
  }
}

const sessionCookie = async (page: Page) =>
  (await page.context().cookies()).find((c) => c.name.includes("session_token"));

async function addContactThroughForm(page: Page, name: string) {
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  // A click before the page has come to life does nothing, so it is repeated until the form opens
  await expect(async () => {
    await page.getByRole("button", { name: "Добавить контакт" }).first().click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByLabel("Имя", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.describe("Без входа приложение не открывается", () => {
  test("Открыл приложение без входа", async ({ page }) => {
    await page.goto("/");

    await expect(loginHeading(page)).toBeVisible();
    await expect(page.getByLabel("Почта")).toBeVisible();
    await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
    await expect(contactRows(page)).toHaveCount(0);
  });

  test("Ссылка на карточку без входа", async ({ page }) => {
    const user = await addUser(ANNA);
    const anna = await addContact(user.id, "Анна Смирнова");

    for (const address of [`/contacts/${anna.id}`, "/groups"]) {
      await page.goto(address);

      await expect(loginHeading(page)).toBeVisible();
      await expect(page.getByText("Анна Смирнова")).toHaveCount(0);
    }
  });

  test("Вошедший открыл страницу входа", async ({ page }) => {
    const user = await addUser(ANNA);
    await addContacts(user.id, "Анна Смирнова");
    await signIn(page, ANNA);

    await page.goto("/login");

    await expect(page).toHaveURL("/");
    await expect(contactRows(page)).toHaveText([/Анна Смирнова/]);
  });
});

test.describe("Вход по ссылке", () => {
  test("Вошёл по ссылке", async ({ page }) => {
    const user = await addUser(ANNA);
    await addContacts(user.id, "Анна Смирнова", "Борис Медведев");

    await signIn(page, ANNA);

    await expect(page.getByText("2 контакта", { exact: true })).toBeVisible();
    await expect(header(page).getByText(ANNA)).toBeVisible();
  });

  test("Первый вход — и есть регистрация", async ({ page }) => {
    // Nobody has ever signed in under this email, and no name or other question is asked
    await signIn(page, BORIS);

    await expect(page.getByText("0 контактов", { exact: true })).toBeVisible();
    await expect(header(page).getByText(BORIS)).toBeVisible();
  });

  test("Кнопка на страницу входа", async ({ page }) => {
    await page.goto("/login/expired");
    await expect(page.getByRole("heading", { name: "Ссылка устарела, запросите новую" })).toBeVisible();

    await page.getByRole("link", { name: "Получить новую ссылку" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByLabel("Почта")).toBeVisible();
  });

  test("Испорченная ссылка", async ({ page }) => {
    await requestLoginLink(page, ANNA);
    const link = await mailbox.findLoginLink(ANNA);

    await page.goto(link.replace(/token=([^&]*)/, (_, token: string) => `token=${token.slice(0, -4)}`));

    await expect(page.getByRole("heading", { name: "Ссылка устарела, запросите новую" })).toBeVisible();
  });

  test("Ссылка второй раз", async ({ page }) => {
    await requestLoginLink(page, ANNA);
    const link = await mailbox.findLoginLink(ANNA);
    await page.goto(link);
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(loginHeading(page)).toBeVisible();

    await page.goto(link);

    await expect(page.getByRole("heading", { name: "Ссылка устарела, запросите новую" })).toBeVisible();
  });
});

test.describe("Сколько держится вход", () => {
  test("Вернулся на следующий день", async ({ page }) => {
    const user = await addUser(ANNA);
    await addContacts(user.id, "Анна Смирнова");
    await signIn(page, ANNA);
    await ageSessions(ANNA, 1);

    // The browser was closed and opened again: the cookie is all that is left
    const next = await page.context().newPage();
    await next.goto("/");

    await expect(contactRows(next)).toHaveText([/Анна Смирнова/]);
  });

  test("Заход продлевает вход", async ({ page }) => {
    await signIn(page, ANNA);
    // Two days ago: the login in the database and the cookie in the browser both run out in 28 days
    await ageSessions(ANNA, 2);
    const cookie = (await sessionCookie(page))!;
    await page.context().addCookies([{ ...cookie, expires: Date.now() / 1000 + 28 * DAY_SECONDS }]);

    await page.goto("/");

    await expect(page.getByText("0 контактов", { exact: true })).toBeVisible();
    // 30 days from today's visit, give or take the hour a login is moved at
    const around30Days = (seconds: number) => {
      expect(seconds).toBeGreaterThan(30 * DAY_SECONDS - 3600);
      expect(seconds).toBeLessThan(30 * DAY_SECONDS + 3600);
    };
    around30Days(((await sessionCookie(page))!.expires as number) - Date.now() / 1000);
    const [expiresAt] = await readSessionExpiry(ANNA);
    around30Days((expiresAt.getTime() - Date.now()) / 1000);
  });

  test("Не заходил 30 дней", async ({ page }) => {
    await signIn(page, ANNA);
    await expireSessions(ANNA);

    await page.goto("/");

    await expect(loginHeading(page)).toBeVisible();
  });

  test("Компьютер и телефон", async ({ page, browser }) => {
    const user = await addUser(ANNA);
    await addContacts(user.id, "Анна Смирнова", "Борис Медведев");
    await signIn(page, ANNA);

    await inOtherBrowser(browser, async (phone) => {
      await signIn(phone, ANNA);

      await expect(contactRows(phone)).toHaveText([/Анна Смирнова/, /Борис Медведев/]);
    });

    // The first device is still inside
    await page.reload();
    await expect(contactRows(page)).toHaveText([/Анна Смирнова/, /Борис Медведев/]);
  });
});

test.describe("Почта и «Выйти» в шапке", () => {
  test("Почта в шапке", async ({ page }) => {
    const user = await addUser(ANNA);
    const anna = await addContact(user.id, "Анна Смирнова");
    await signIn(page, ANNA);

    for (const address of ["/", "/groups", `/contacts/${anna.id}`]) {
      await page.goto(address);

      await expect(header(page).getByText(ANNA)).toBeVisible();
      await expect(header(page).getByRole("button", { name: "Выйти" })).toBeVisible();
    }
  });

  test("Вышел", async ({ page }) => {
    await signIn(page, ANNA);

    await page.getByRole("button", { name: "Выйти" }).click();

    await expect(loginHeading(page)).toBeVisible();
    await expect(header(page).getByText(ANNA)).toHaveCount(0);
    await page.goBack();
    await expect(loginHeading(page)).toBeVisible();
    await page.goto("/");
    await expect(loginHeading(page)).toBeVisible();
  });

  test("Выход только на этом устройстве", async ({ page, browser }) => {
    await signIn(page, ANNA);

    await inOtherBrowser(browser, async (phone) => {
      await signIn(phone, ANNA);

      await page.getByRole("button", { name: "Выйти" }).click();
      await expect(loginHeading(page)).toBeVisible();

      await phone.reload();
      await expect(phone.getByText("0 контактов", { exact: true })).toBeVisible();
    });
  });

  test("Письмо на моём компьютере", async ({ page }) => {
    // An address that does not exist anywhere: the email stays in Mailpit and is enough to sign in
    const nobody = mailbox.testEmail("nobody-at-all");

    await signIn(page, nobody);

    await expect(header(page).getByText(nobody)).toBeVisible();
    const [email] = await mailbox.findEmails(nobody);
    expect(email.subject).toBe("Вход в Личную CRM");
  });
});

test.describe("Пустой список", () => {
  test("Пустой список", async ({ page }) => {
    await signIn(page, ANNA);

    await expect(emptyBlock(page)).toBeVisible();
    await expect(page.getByText("Добавьте первого человека, о ком не хочется забыть.")).toBeVisible();
    await expect(emptyBlock(page).getByRole("button", { name: "Добавить контакт" })).toBeVisible();
    // The only such button is the one in the block
    await expect(page.getByRole("button", { name: "Добавить контакт" })).toHaveCount(1);
    await expect(topAddButton(page)).toHaveCount(0);
  });

  test("Кнопка в пустом списке", async ({ page }) => {
    await signIn(page, ANNA);

    await addContactThroughForm(page, "Анна Смирнова");

    await expect(page.getByText("1 контакт", { exact: true })).toBeVisible();
    await expect(contactRows(page)).toHaveText([/Анна Смирнова/]);
    await expect(page.getByText("Здесь пока никого нет")).toHaveCount(0);
    await expect(topAddButton(page)).toBeVisible();
  });

  test("Удалил последний контакт", async ({ page }) => {
    const user = await addUser(ANNA);
    await addContacts(user.id, "Анна Смирнова");
    await signIn(page, ANNA);
    await expect(topAddButton(page)).toBeVisible();

    // A click before the page has come to life does nothing, so it is repeated until the question shows
    const question = page.getByRole("dialog", { name: "Вы точно хотите удалить контакт?" });
    await expect(async () => {
      await page.getByRole("button", { name: "Удалить контакт Анна Смирнова" }).click();
      await expect(question).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await question.getByRole("button", { name: "Удалить", exact: true }).click();

    await expect(emptyBlock(page)).toBeVisible();
    await expect(emptyBlock(page).getByRole("button", { name: "Добавить контакт" })).toBeVisible();
    await expect(topAddButton(page)).toHaveCount(0);
  });

  test("Поиск без результатов", async ({ page }) => {
    const user = await addUser(ANNA);
    await addContacts(user.id, "Анна Смирнова");
    await signIn(page, ANNA);

    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("Яков");

    await expect(page.getByText("Никого не нашли по запросу «Яков»")).toBeVisible();
    await expect(page.getByText("Здесь пока никого нет")).toHaveCount(0);
    await expect(topAddButton(page)).toBeVisible();
  });
});

test.describe("У каждого свои данные", () => {
  test("A вошёл и добавил контакт; B вошёл и не видит контакт A", async ({ page, browser }) => {
    // B has a contact of their own, so the list is not empty and a search can find nothing in it
    const boris = await addUser(BORIS);
    await addContacts(boris.id, "Борис Медведев");
    await signIn(page, ANNA);
    await addContactThroughForm(page, "Анна Смирнова");
    await expect(contactRows(page)).toHaveText([/Анна Смирнова/]);
    await page.getByRole("link", { name: "Анна Смирнова" }).click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
    const contactAddress = page.url();

    await inOtherBrowser(browser, async (other) => {
      await signIn(other, BORIS);

      await expect(other.getByText("1 контакт", { exact: true })).toBeVisible();
      await expect(contactRows(other)).toHaveText([/Борис Медведев/]);

      await other.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("Анна");
      await expect(other.getByText("Никого не нашли по запросу «Анна»")).toBeVisible();

      await other.goto(contactAddress);
      await expect(other.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
      await expect(other.getByText("Анна Смирнова")).toHaveCount(0);
    });
  });

  test("Чужой контакт по прямой ссылке", async ({ page }) => {
    const anna = await addUser(ANNA);
    const contact = await addContact(anna.id, "Анна Смирнова", { about: "Подруга по университету" });
    await addUser(BORIS);
    await signIn(page, BORIS);

    await page.goto(`/contacts/${contact.id}`);

    await expect(page.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ко всем контактам" })).toBeVisible();
    await expect(page.getByText("Анна Смирнова")).toHaveCount(0);
    await expect(page.getByText("Подруга по университету")).toHaveCount(0);
  });

  test("Несуществующий контакт", async ({ page }) => {
    await signIn(page, BORIS);

    await page.goto(NO_SUCH_CONTACT);

    await expect(page.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ко всем контактам" })).toBeVisible();
  });

  test("Первый вход нового пользователя", async ({ page }) => {
    // A has plenty of everything; the newcomer starts with nothing
    const anna = await addUser(ANNA);
    await addContacts(anna.id, "Анна Смирнова", "Вера Николаева");

    await signIn(page, BORIS);

    await expect(page.getByText("0 контактов", { exact: true })).toBeVisible();
    await expect(emptyBlock(page)).toBeVisible();
    await expect(page.getByRole("region", { name: "Пора связаться" })).toHaveCount(0);
    await page.goto("/groups");
    await expect(page.getByText("Групп пока нет. Нажмите «Создать группу».")).toBeVisible();
  });
});
