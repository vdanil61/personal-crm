import { type Page, type Request, expect } from "@playwright/test";

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
  // Retry a click before hydration, but never send a second request while the first is pending:
  // it would invalidate the link in the first email on a cold server.
  let submitted = false;
  const observeSubmit = (request: Request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/login") submitted = true;
  };
  page.on("request", observeSubmit);
  try {
    await expect(async () => {
      if (!submitted) await page.getByRole("button", { name: "Получить ссылку" }).click();
      await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible({ timeout: 2_000 });
    }).toPass();
  } finally {
    page.off("request", observeSubmit);
  }
}
