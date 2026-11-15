import { type Locator, type Page, expect, test } from "@playwright/test";

import { signIn } from "./support/auth";
import { addContact, addUser, closeDb, putInGroup, resetDb } from "./support/db";
import { mailbox } from "./support/mailpit";
import { birthdayWindow, formatBirthdayOccurrence } from "../src/lib/birthdays";

const EMAIL = mailbox.testEmail("birthdays");
let userId: string;
test.beforeEach(async ({ page }) => {
  await resetDb();
  userId = (await addUser(EMAIL)).id;
  await signIn(page, EMAIL);
});
test.afterAll(closeDb);

const block = (page: Page) => page.getByRole("region", { name: "Скоро день рождения" });
const cardDate = (page: Page) => page.locator('dt:has-text("Дата рождения") + dd');
const editDialog = (page: Page) => page.getByRole("dialog", { name: "Изменить контакт" });
async function openDialog(page: Page, name = "Изменить контакт") {
  const dialog = page.getByRole("dialog", { name: name === "Добавить контакт" ? "Новый контакт" : name });
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole("button", { name, exact: true }).click({ timeout: 1000 });
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  return dialog;
}
async function fillBirthday(page: Page, dialog: Locator, day: string, month: string, year = "") {
  await dialog.getByLabel("День", { exact: true }).fill(day);
  await dialog.getByLabel("Месяц", { exact: true }).click();
  await page.getByRole("option", { name: month, exact: true }).click();
  await dialog.getByLabel("Год", { exact: true }).fill(year);
}
async function save(page: Page, dialog: Locator) {
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toBeHidden();
}
async function create(page: Page, day: string, month: string, year = "") {
  const dialog = await openDialog(page, "Добавить контакт");
  await dialog.getByLabel("Имя", { exact: true }).fill("Анна");
  await fillBirthday(page, dialog, day, month, year);
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.locator("[data-contact-row]").getByRole("link", { name: "Анна", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Анна");
  await page.reload();
}

test("B01 creates a birthday without a year", async ({ page }) => {
  await create(page, "15", "Ноябрь");
  await expect(cardDate(page)).toHaveText("15 ноября");
  const dialog = await openDialog(page);
  await expect(dialog.getByLabel("День", { exact: true })).toHaveValue("15");
  await expect(dialog.getByLabel("Месяц", { exact: true }).locator('[data-slot="select-value"]')).toHaveText("Ноябрь");
  await expect(dialog.getByLabel("Год", { exact: true })).toHaveValue("");
});
test("B02 creates a complete birthday", async ({ page }) => {
  await create(page, "15", "Ноябрь", "1990");
  await expect(cardDate(page)).toHaveText("15 ноября 1990");
  const dialog = await openDialog(page);
  await expect(dialog.getByLabel("День", { exact: true })).toHaveValue("15");
  await expect(dialog.getByLabel("Месяц", { exact: true }).locator('[data-slot="select-value"]')).toHaveText("Ноябрь");
  await expect(dialog.getByLabel("Год", { exact: true })).toHaveValue("1990");
});
test("B03 creates a contact without a birthday", async ({ page }) => {
  await create(page, "", "Не указан");
  await expect(cardDate(page)).toHaveText("не указано");
  await page.goto("/");
  await expect(block(page)).toBeHidden();
});
test("B04 changes a birthday and removes its year", async ({ page }) => {
  const contact = await addContact(userId, "Анна", { birthdayDay: 15, birthdayMonth: 11, birthdayYear: 1990 });
  await page.goto(`/contacts/${contact.id}`);
  const dialog = await openDialog(page);
  await fillBirthday(page, dialog, "16", "Декабрь");
  await save(page, dialog);
  await page.reload();
  await expect(cardDate(page)).toHaveText("16 декабря");
  await openDialog(page);
  await expect(editDialog(page).getByLabel("Год", { exact: true })).toHaveValue("");
});
test("B05 clears every birthday part", async ({ page }) => {
  const date = birthdayWindow(new Date())[1];
  const contact = await addContact(userId, "Анна", {
    birthdayDay: date.day,
    birthdayMonth: date.month,
    birthdayYear: 2000,
  });
  await page.goto("/");
  await expect(block(page)).toBeVisible();
  await page.goto(`/contacts/${contact.id}`);
  const dialog = await openDialog(page);
  await fillBirthday(page, dialog, "", "Не указан");
  await save(page, dialog);
  await expect(cardDate(page)).toHaveText("не указано");
  await page.goto("/");
  await expect(block(page)).toBeHidden();
});
for (const [id, day, month, year, error] of [
  ["B06 day only", "15", "Не указан", "", "Укажите день и месяц"],
  ["B06 month only", "", "Ноябрь", "", "Укажите день и месяц"],
  ["B06 year only", "", "Не указан", "1990", "Укажите день и месяц"],
  ["B07 April 31", "31", "Апрель", "", "Проверьте дату рождения"],
  ["B08 common year", "29", "Февраль", "1991", "Проверьте дату рождения"],
]) {
  test(`${id} keeps the form values and rejects an invalid date`, async ({ page }) => {
    const dialog = await openDialog(page, "Добавить контакт");
    await dialog.getByLabel("Имя", { exact: true }).fill("Анна");
    await dialog.getByLabel("Кто это", { exact: true }).fill("Знакомая");
    await fillBirthday(page, dialog, day, month, year);
    await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(dialog.getByText(error, { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Имя", { exact: true })).toHaveValue("Анна");
    await expect(dialog.getByLabel("Кто это", { exact: true })).toHaveValue("Знакомая");
    await expect(dialog.getByLabel("День", { exact: true })).toHaveValue(day);
    await expect(dialog.getByLabel("Месяц", { exact: true }).locator('[data-slot="select-value"]')).toHaveText(month);
    await expect(dialog.getByLabel("Год", { exact: true })).toHaveValue(year);
    await page.reload();
    await expect(page.locator("[data-contact-row]")).toHaveCount(0);
  });
}
for (const year of ["", "2000"]) {
  test(`B09 accepts February 29 with year '${year}'`, async ({ page }) => {
    await create(page, "29", "Февраль", year);
    await expect(cardDate(page)).toHaveText(`29 февраля${year ? ` ${year}` : ""}`);
  });
}

const filterBar = (page: Page) => page.getByRole("navigation", { name: "Фильтр по группам" });
const birthdayNames = ["Анна", "Борис", "Вера", "Глеб", "Дарья", "Егор", "Жанна"];
async function upcoming(name: string, offset = 1) {
  const date = birthdayWindow(new Date())[offset];
  return addContact(userId, name, { birthdayDay: date.day, birthdayMonth: date.month });
}

test("B10 shows today and day six but excludes yesterday and day seven", async ({ page }) => {
  const dates = birthdayWindow(new Date());
  await upcoming("Сегодня", 0);
  await upcoming("Шестой день", 6);
  const date = new Date(0);
  date.setUTCFullYear(dates[0].year, dates[0].month - 1, dates[0].day);
  for (const [name, offset] of [
    ["Вчера", -1],
    ["Седьмой день", 7],
  ] as const) {
    const shifted = new Date(date);
    shifted.setUTCDate(shifted.getUTCDate() + offset);
    await addContact(userId, name, { birthdayDay: shifted.getUTCDate(), birthdayMonth: shifted.getUTCMonth() + 1 });
  }
  await addContact(userId, "Без даты");
  await page.goto("/");
  await expect(block(page).getByRole("listitem")).toHaveText([
    new RegExp(`Сегодня${formatBirthdayOccurrence(dates[0])}`),
    new RegExp(`Шестой день${formatBirthdayOccurrence(dates[6])}`),
  ]);
});
test("B17 places names and dates between the filter and keep-in-touch", async ({ page }) => {
  await upcoming("Анна");
  await addContact(userId, "Борис", { contactFrequency: "week", createdAt: new Date(Date.now() - 40 * 86400000) });
  await putInGroup(userId, (await upcoming("Вера")).id, "Семья");
  await page.goto("/");
  const regions = [
    filterBar(page),
    block(page),
    page.getByRole("region", { name: "Пора связаться" }),
    page.getByRole("searchbox"),
  ];
  const positions = [];
  for (const region of regions) {
    await expect(region).toBeVisible();
    positions.push((await region.boundingBox())!.y);
  }
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  await expect(block(page).getByRole("link", { name: /Анна/ })).toContainText(
    formatBirthdayOccurrence(birthdayWindow(new Date())[1]),
  );
});
test("B18 hides an empty birthday block", async ({ page }) => {
  await addContact(userId, "Без даты");
  await page.goto("/");
  await expect(block(page)).toBeHidden();
  await expect(page.getByRole("heading", { name: "Скоро день рождения" })).toHaveCount(0);
});
test("B19 opens the selected card and returns to the same list", async ({ page }) => {
  const contact = await upcoming("Анна");
  await putInGroup(userId, contact.id, "Семья");
  await page.goto("/?size=10");
  await filterBar(page).getByRole("link", { name: "Семья", exact: true }).click();
  await expect(page).toHaveURL(/groups=/);
  const listUrl = page.url();
  await block(page).getByRole("link", { name: /Анна/ }).click();
  await expect(page).toHaveURL(`/contacts/${contact.id}`);
  await expect(cardDate(page)).toHaveText(formatBirthdayOccurrence(birthdayWindow(new Date())[1]));
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(page).toHaveURL(listUrl);
});
test("B20 keeps all seven birthdays across list pages", async ({ page }) => {
  for (let i = 0; i < 10; i++) await addContact(userId, `А ${i}`);
  for (const name of birthdayNames) await upcoming(name);
  await page.goto("/?size=10");
  await expect(block(page).getByRole("listitem")).toHaveCount(7);
  const text = await block(page).getByRole("listitem").allTextContents();
  await page.getByRole("link", { name: "Дальше" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(block(page).getByRole("listitem")).toHaveText(text);
});
test("B21 orders by date and then by Russian name", async ({ page }) => {
  await upcoming("Вера", 0);
  await upcoming("Борис");
  await upcoming("Анна");
  await upcoming("Глеб", 6);
  await page.goto("/");
  await expect(block(page).getByRole("listitem")).toHaveText([/Вера/, /Анна/, /Борис/, /Глеб/]);
});

test("B22 filters by one group", async ({ page }) => {
  const anna = await upcoming("Анна");
  const boris = await upcoming("Борис");
  await putInGroup(userId, anna.id, "Семья");
  await putInGroup(userId, boris.id, "Друзья");
  await page.goto("/");
  await expect(block(page).getByRole("listitem")).toHaveCount(2);
  await filterBar(page).getByRole("link", { name: "Семья", exact: true }).click();
  await expect(block(page).getByRole("listitem")).toHaveText([/Анна/]);
});
test("B23 intersects selected groups", async ({ page }) => {
  const anna = await upcoming("Анна");
  const boris = await upcoming("Борис");
  const vera = await upcoming("Вера");
  await putInGroup(userId, anna.id, "Друзья");
  await putInGroup(userId, anna.id, "Теннис");
  await putInGroup(userId, boris.id, "Друзья");
  await putInGroup(userId, vera.id, "Теннис");
  await page.goto("/");
  await filterBar(page).getByRole("link", { name: "Друзья", exact: true }).click();
  await expect(filterBar(page).getByRole("link", { name: "Друзья", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(block(page).getByRole("listitem")).toHaveText([/Анна/, /Борис/]);
  await filterBar(page).getByRole("link", { name: "Теннис", exact: true }).click();
  await expect(block(page).getByRole("listitem")).toHaveText([/Анна/]);
});
test("B24 filters contacts without groups", async ({ page }) => {
  const anna = await upcoming("Анна");
  await upcoming("Борис");
  await putInGroup(userId, anna.id, "Друзья");
  await page.goto("/");
  await filterBar(page).getByRole("link", { name: "Без группы", exact: true }).click();
  await expect(block(page).getByRole("listitem")).toHaveText([/Борис/]);
});
test("B25 hides an empty group and restores all birthdays", async ({ page }) => {
  await upcoming("Анна");
  const tennis = await addContact(userId, "Теннисист");
  await putInGroup(userId, tennis.id, "Теннис");
  await page.goto("/");
  await expect(block(page)).toBeVisible();
  await filterBar(page).getByRole("link", { name: "Теннис", exact: true }).click();
  await expect(block(page)).toBeHidden();
  await filterBar(page).getByRole("link", { name: "Все", exact: true }).click();
  await expect(block(page).getByRole("listitem")).toHaveText([/Анна/]);
});
test("B26 search hides the block and clearing restores the selected filter", async ({ page }) => {
  const anna = await upcoming("Анна");
  await upcoming("Борис");
  await putInGroup(userId, anna.id, "Семья");
  await page.goto("/");
  await filterBar(page).getByRole("link", { name: "Семья", exact: true }).click();
  const search = page.getByRole("searchbox");
  await search.fill("Анна");
  await expect(block(page)).toBeHidden();
  await search.fill("");
  await expect(block(page).getByRole("listitem")).toHaveText([/Анна/]);
  await search.fill("   ");
  await expect(block(page).getByRole("listitem")).toHaveText([/Анна/]);
});

test("B27 hides another user's birthday and card", async ({ page }) => {
  const other = await addUser(mailbox.testEmail("birthday-other"));
  const date = birthdayWindow(new Date())[0];
  const contact = await addContact(other.id, "Чужой", {
    birthdayDay: date.day,
    birthdayMonth: date.month,
    birthdayYear: 1990,
  });
  await page.goto("/");
  await expect(block(page)).toBeHidden();
  await page.goto(`/contacts/${contact.id}`);
  await expect(page.getByText("Контакт не найден", { exact: true })).toBeVisible();
  await expect(cardDate(page)).toHaveCount(0);
});
test("B28 an old tab cannot change a birthday after switching users", async ({ page, context }) => {
  const contact = await addContact(userId, "Анна", { birthdayDay: 15, birthdayMonth: 11, birthdayYear: 1990 });
  await page.goto(`/contacts/${contact.id}`);
  const dialog = await openDialog(page);
  const otherPage = await context.newPage();
  await otherPage.goto("/");
  await otherPage.getByRole("button", { name: "Выйти", exact: true }).click();
  const otherEmail = mailbox.testEmail("birthday-switch");
  await signIn(otherPage, otherEmail);
  await fillBirthday(page, dialog, "16", "Декабрь");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog.getByText("Этот контакт больше не существует.", { exact: true })).toBeVisible();
  await otherPage.getByRole("button", { name: "Выйти", exact: true }).click();
  await signIn(otherPage, EMAIL);
  await page.goto(`/contacts/${contact.id}`);
  await expect(cardDate(page)).toHaveText("15 ноября 1990");
  await otherPage.close();
});
for (const year of [null, 2000]) {
  test(`B30 undo restores a birthday with year ${year}`, async ({ page }) => {
    const date = birthdayWindow(new Date())[1];
    const contact = await addContact(userId, "Анна", {
      birthdayDay: date.day,
      birthdayMonth: date.month,
      birthdayYear: year,
    });
    await page.goto(`/contacts/${contact.id}`);
    await page.getByRole("button", { name: "Удалить контакт Анна", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Вы точно хотите удалить контакт?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByText("Контакт «Анна» удалён", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect(page.getByText("Контакт «Анна» восстановлен", { exact: true })).toBeVisible();
    await page.goto(`/contacts/${contact.id}`);
    await expect(cardDate(page)).toHaveText(`${formatBirthdayOccurrence(date)}${year ? ` ${year}` : ""}`);
    await page.goto("/");
    await expect(block(page).getByRole("listitem")).toHaveText([/Анна/]);
  });
}
