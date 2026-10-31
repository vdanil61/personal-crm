import { type Locator, type Page, expect, test } from "@playwright/test";

import { addContact, addNote, closeDb, putInGroup, resetDb } from "./support/db";

// The ways through the "Пора связаться" block from openspec/specs/keep-in-touch/spec.md
// that only a browser can check; the logic behind the block is covered by the unit tests

test.beforeEach(resetDb);
test.afterAll(closeDb);

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// Weekly, added long ago, never in touch: overdue. The older one is higher in the block.
const addOverdue = (name: string, addedDaysAgo = 40) =>
  addContact(name, { contactFrequency: "week", createdAt: daysAgo(addedDaysAgo) });

const keepInTouch = (page: Page) => page.getByRole("region", { name: "Пора связаться" });
const overdueRows = (page: Page) => keepInTouch(page).getByRole("listitem");
// The number in the header of the block, e.g. "3 человека"
const overdueCount = (page: Page) => keepInTouch(page).getByLabel(/^\d+ человека?$/);
const contactRows = (page: Page) => page.locator("[data-contact-row]");
const noteItems = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Заметки" }) })
    .getByRole("listitem");

// A click before the page has come to life does nothing, and so does a click on a row button
// right after the rows moved (row-shift-guard.ts). So the click is repeated until its result shows;
// once the button is gone the click has worked and is not repeated.
async function clickUntil(button: Locator, result: Locator) {
  await expect(async () => {
    if (await button.isVisible()) await button.click({ timeout: 1_000 });
    await expect(result).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

async function pressContacted(page: Page, name: string) {
  await clickUntil(
    keepInTouch(page).getByRole("button", { name: `Связался: ${name}` }),
    page.getByText(`Отмечено: ${name}`),
  );
}

test.describe("Пора связаться", () => {
  test("задал частоту → человек в блоке → написал заметку → ушёл из блока", async ({ page }) => {
    await addOverdue("Борис Медведев", 41);
    await addOverdue("Вера Николаева");
    const anna = await addContact("Анна Смирнова", { createdAt: daysAgo(400) });
    await addNote(anna.id, daysAgo(40), "Обедали вместе");

    await test.step("открыл главную → в блоке двое", async () => {
      await page.goto("/");

      await expect(overdueCount(page)).toHaveText("2");
      await expect(overdueRows(page)).toHaveText([/Борис Медведев/, /Вера Николаева/]);
    });

    await test.step("задал Анне «Раз в месяц» → в карточке «раз в месяц»", async () => {
      await page.getByRole("link", { name: "Анна Смирнова" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Анна Смирнова");

      const dialog = page.getByRole("dialog", { name: "Изменить контакт" });
      await clickUntil(page.getByRole("button", { name: "Изменить контакт" }), dialog);
      await dialog.getByLabel("Как часто общаться").click();
      await page.getByRole("option", { name: "Раз в месяц" }).click();
      await dialog.getByRole("button", { name: "Сохранить" }).click();

      await expect(dialog).toBeHidden();
      await expect(page.locator('dt:has-text("Как часто общаться") + dd')).toHaveText("раз в месяц");
    });

    await test.step("на главной Анна сразу в блоке над списком, в заголовке 3", async () => {
      await page.goto("/");

      await expect(overdueCount(page)).toHaveText("3");
      // Her period passed later than theirs, so she is the last
      await expect(overdueRows(page)).toHaveText([
        /Борис Медведев/,
        /Вера Николаева/,
        /Анна Смирнова.*раз в месяц · связались/,
      ]);
      const block = await keepInTouch(page).boundingBox();
      const list = await contactRows(page).first().boundingBox();
      expect(block!.y).toBeLessThan(list!.y);
    });

    await test.step("открыл Анну из блока → написал заметку", async () => {
      await keepInTouch(page)
        .getByRole("link", { name: /Анна Смирнова/ })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Анна Смирнова");

      await page.getByRole("textbox", { name: "Новая заметка" }).fill("Созвонились, всё хорошо");
      await page.getByRole("button", { name: "Добавить заметку" }).click();

      await expect(noteItems(page)).toHaveCount(2);
    });

    await test.step("вернулся на главную → Анны в блоке нет, в заголовке 2", async () => {
      await page.goto("/");

      await expect(overdueCount(page)).toHaveText("2");
      await expect(overdueRows(page)).toHaveText([/Борис Медведев/, /Вера Николаева/]);
    });
  });

  test("нажал «Связался» → человек ушёл из блока, заметка не появилась, отметка сохранилась", async ({ page }) => {
    const anna = await addOverdue("Анна Смирнова", 41);
    await addNote(anna.id, daysAgo(40), "Обедали вместе");
    await addOverdue("Борис Медведев");

    await test.step("нажал «Связался» у Анны → она пропала, я на главной, внизу «Отмечено»", async () => {
      await page.goto("/");
      await expect(overdueCount(page)).toHaveText("2");

      await pressContacted(page, "Анна Смирнова");

      await expect(overdueRows(page)).toHaveText([/Борис Медведев/]);
      await expect(overdueCount(page)).toHaveText("1");
      expect(new URL(page.url()).pathname).toBe("/");
      // The mark can't be undone
      await expect(page.getByRole("button", { name: "Отменить" })).toHaveCount(0);
    });

    await test.step("обновил страницу → Анны в блоке нет", async () => {
      await page.reload();

      await expect(overdueRows(page)).toHaveText([/Борис Медведев/]);
    });

    await test.step("открыл карточку Анны → заметок столько же", async () => {
      await page.getByRole("link", { name: "Анна Смирнова" }).click();

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Анна Смирнова");
      await expect(noteItems(page)).toHaveCount(1);
    });

    await test.step("отметил последнего → блока нет, список на месте", async () => {
      await page.goto("/");

      await pressContacted(page, "Борис Медведев");

      await expect(keepInTouch(page)).toBeHidden();
      await expect(contactRows(page)).toHaveText([/Анна Смирнова/, /Борис Медведев/]);
    });
  });

  test("первые пять → «Показать всех» → «Свернуть» → отметил одного из шести", async ({ page }) => {
    const names = [
      "Анна Смирнова",
      "Борис Медведев",
      "Вера Николаева",
      "Глеб Фёдоров",
      "Дарья Кузнецова",
      "Егор Белов",
      "Жанна Орлова",
    ];
    // Anna is the most overdue, Zhanna the least
    for (const [index, name] of names.entries()) await addOverdue(name, 50 - index);
    const rowsOf = (shown: string[]) => shown.map((name) => new RegExp(name));
    const showAll = (total: number) => keepInTouch(page).getByRole("button", { name: `Показать всех (${total})` });
    const collapse = keepInTouch(page).getByRole("button", { name: "Свернуть" });

    await test.step("7 просроченных → видны первые 5 и «Показать всех (7)»", async () => {
      await page.goto("/");

      await expect(overdueCount(page)).toHaveText("7");
      await expect(overdueRows(page)).toHaveText(rowsOf(names.slice(0, 5)));
      await expect(showAll(7)).toBeVisible();
    });

    await test.step("«Показать всех» → видны все 7 и «Свернуть»", async () => {
      await clickUntil(showAll(7), collapse);

      await expect(overdueRows(page)).toHaveText(rowsOf(names));
    });

    await test.step("«Свернуть» → снова 5", async () => {
      await clickUntil(collapse, showAll(7));

      await expect(overdueRows(page)).toHaveText(rowsOf(names.slice(0, 5)));
    });

    await test.step("отметил одного → 5 из 6, «Показать всех (6)»", async () => {
      await pressContacted(page, "Анна Смирнова");

      await expect(overdueRows(page)).toHaveText(rowsOf(names.slice(1, 6)));
      await expect(showAll(6)).toBeVisible();
    });

    await test.step("отметил ещё одного → 5, кнопки «Показать всех» нет", async () => {
      await pressContacted(page, "Борис Медведев");

      await expect(overdueRows(page)).toHaveText(rowsOf(names.slice(2)));
      await expect(keepInTouch(page).getByRole("button", { name: /Показать всех/ })).toHaveCount(0);
    });
  });

  test("поиск прячет блок, фильтр по группам меняет его", async ({ page }) => {
    const mother = await addOverdue("Мария Ковалёва", 42);
    const brother = await addOverdue("Олег Васильев", 41);
    await addOverdue("Алексей Зайцев");
    await putInGroup(mother.id, "Семья");
    await putInGroup(brother.id, "Семья");
    // In "Теннис" there is someone, but not overdue
    const tennisPlayer = await addContact("Вера Николаева", { contactFrequency: "year" });
    await putInGroup(tennisPlayer.id, "Теннис");
    const filter = page.getByRole("navigation", { name: "Фильтр по группам" });
    const search = page.getByRole("searchbox", { name: "Найти контакт по имени" });

    await test.step("ввёл часть имени → блока нет, найден один", async () => {
      await page.goto("/");
      await expect(overdueCount(page)).toHaveText("3");

      // Typing before the page has come to life finds nothing, so it is repeated
      await expect(async () => {
        await search.fill("ковал");
        await expect(contactRows(page)).toHaveText([/Мария Ковалёва/], { timeout: 1_000 });
      }).toPass();
      await expect(keepInTouch(page)).toBeHidden();
    });

    await test.step("стёр запрос → блок вернулся", async () => {
      await search.fill("");

      await expect(overdueCount(page)).toHaveText("3");
    });

    await test.step("«Семья» → в блоке двое из семьи", async () => {
      await filter.getByRole("link", { name: "Семья" }).click();

      await expect(overdueCount(page)).toHaveText("2");
      await expect(overdueRows(page)).toHaveText([/Мария Ковалёва/, /Олег Васильев/]);
    });

    await test.step("«Теннис» → блока нет; «Все» → блок снова с тремя", async () => {
      await filter.getByRole("link", { name: "Все" }).click();
      await expect(overdueCount(page)).toHaveText("3");
      await filter.getByRole("link", { name: "Теннис" }).click();

      await expect(contactRows(page)).toHaveText([/Вера Николаева/]);
      await expect(keepInTouch(page)).toBeHidden();

      await filter.getByRole("link", { name: "Все" }).click();

      await expect(overdueCount(page)).toHaveText("3");
    });

    await test.step("«Без группы» → в блоке только тот, у кого нет групп", async () => {
      await filter.getByRole("link", { name: "Без группы" }).click();

      await expect(overdueCount(page)).toHaveText("1");
      await expect(overdueRows(page)).toHaveText([/Алексей Зайцев/]);
    });
  });

  test("быстрое двойное нажатие «Связался» отмечает только одного", async ({ page }) => {
    await addOverdue("Анна Смирнова", 42);
    await addOverdue("Борис Медведев", 41);
    await addOverdue("Вера Николаева");
    await page.goto("/");
    await expect(overdueCount(page)).toHaveText("3");

    // As in clickUntil: a double click before the page has come to life does nothing
    const firstButton = keepInTouch(page).getByRole("button", { name: "Связался: Анна Смирнова" });
    await expect(async () => {
      if (await firstButton.isVisible()) await firstButton.dblclick({ timeout: 1_000 });
      await expect(page.getByText("Отмечено: Анна Смирнова")).toBeVisible({ timeout: 1_000 });
    }).toPass();

    await expect(overdueRows(page)).toHaveText([/Борис Медведев/, /Вера Николаева/]);
    await expect(overdueCount(page)).toHaveText("2");
    // The second click did not mark Boris on the server either
    await page.reload();
    await expect(overdueRows(page)).toHaveText([/Борис Медведев/, /Вера Николаева/]);
  });

  test.describe("на телефоне", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("кнопки — квадраты с галочкой, нажатие работает так же", async ({ page }) => {
      await addOverdue("Анна Смирнова", 41);
      await addOverdue("Борис Медведев");
      await page.goto("/");

      const buttons = keepInTouch(page).getByRole("button", { name: /^Связался: / });
      await expect(buttons).toHaveCount(2);
      for (const button of await buttons.all()) {
        const box = await button.boundingBox();
        expect(Math.round(box!.width)).toBe(Math.round(box!.height));
        await expect(button.getByText("Связался", { exact: true })).toBeHidden();
      }

      await pressContacted(page, "Анна Смирнова");

      await expect(overdueRows(page)).toHaveText([/Борис Медведев/]);
    });
  });
});
