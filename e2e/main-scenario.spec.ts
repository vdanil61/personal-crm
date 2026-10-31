import { type Page, expect, test } from "@playwright/test";

import { addContacts, closeDb, resetDb } from "./support/db";

// The main scenario and its success criteria from specs/01-продуктовая-идея.md

test.beforeEach(resetDb);
test.afterAll(closeDb);

// Rows of the contact list, in the order they are shown
const contactRows = (page: Page) => page.locator("[data-contact-row]");

const noteItems = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Заметки" }) })
    .getByRole("listitem");

test.describe("Главный сценарий", () => {
  test("добавил контакт → нашёл по имени → дописал заметку → она в карточке и в другом браузере", async ({
    page,
    browser,
  }) => {
    await addContacts("Вера Соколова", "Алексей Иванов", "Борис Петров");
    const name = "Дарья Кузнецова";
    const note = "Созвонились, договорились встретиться в пятницу и обсудить поездку";

    await test.step("открыл → видно список всех контактов", async () => {
      await page.goto("/");

      await expect(page.getByText("3 контакта", { exact: true })).toBeVisible();
      await expect(contactRows(page)).toHaveText([/Алексей Иванов/, /Борис Петров/, /Вера Соколова/]);
    });

    await test.step("добавил контакт → появился в списке", async () => {
      const dialog = page.getByRole("dialog", { name: "Новый контакт" });
      // A click before the page has come to life does nothing, so it is repeated until the form opens
      await expect(async () => {
        await page.getByRole("button", { name: "Добавить контакт" }).click();
        await expect(dialog).toBeVisible({ timeout: 1_000 });
      }).toPass();

      await dialog.getByLabel("Имя", { exact: true }).fill(name);
      await dialog.getByRole("button", { name: "Добавить", exact: true }).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByText("4 контакта", { exact: true })).toBeVisible();
      await expect(contactRows(page)).toHaveText([
        /Алексей Иванов/,
        /Борис Петров/,
        /Вера Соколова/,
        /Дарья Кузнецова/,
      ]);
    });

    await test.step("нашёл по имени → открыл карточку", async () => {
      // Part of the name in lower case
      await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("кузнец");

      await expect(contactRows(page)).toHaveText([/Дарья Кузнецова/]);

      await page.getByRole("link", { name }).click();

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    });

    await test.step("дописал заметку → она в карточке", async () => {
      await page.getByRole("textbox", { name: "Новая заметка" }).fill(note);
      await page.getByRole("button", { name: "Добавить заметку" }).click();

      await expect(noteItems(page)).toHaveCount(1);
      await expect(noteItems(page)).toContainText(note);
    });

    await test.step("обновил страницу → заметка сохранилась", async () => {
      await page.reload();

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(noteItems(page)).toHaveCount(1);
      await expect(noteItems(page)).toContainText(note);
    });

    await test.step("открыл тот же адрес в другом браузере → тот же контакт и те же контакты", async () => {
      // A new context shares nothing with the first one, like another browser: no cookies, no storage, no cache
      const otherBrowser = await browser.newContext();
      try {
        const other = await otherBrowser.newPage();

        await other.goto(page.url());
        await expect(other.getByRole("heading", { level: 1 })).toHaveText(name);
        await expect(noteItems(other)).toHaveCount(1);
        await expect(noteItems(other)).toContainText(note);

        await other.goto(new URL("/", page.url()).href);
        await expect(other.getByText("4 контакта", { exact: true })).toBeVisible();
        await expect(contactRows(other)).toHaveText([
          /Алексей Иванов/,
          /Борис Петров/,
          /Вера Соколова/,
          /Дарья Кузнецова/,
        ]);
      } finally {
        await otherBrowser.close();
      }
    });
  });
});
