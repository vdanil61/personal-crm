import { type Page, expect } from "@playwright/test";

import { mailbox } from "./mailpit";

// Signs in the way a person does: asks for a link on the login page, takes the link from the email
// that Mailpit caught and opens it. Every browser test that needs a signed-in user starts with this.
export async function signIn(page: Page, email: string) {
  await requestLoginLink(page, email);
  await page.goto(await mailbox.findLoginLink(email));
  await expect(page).toHaveURL("/");
}

export async function requestLoginLink(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Почта").fill(email);
  // A click before the page has come to life submits nothing, so it is repeated until the answer shows
  await expect(async () => {
    await page.getByRole("button", { name: "Получить ссылку" }).click();
    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible({ timeout: 2_000 });
  }).toPass();
}
