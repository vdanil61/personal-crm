import { describe, expect, it } from "vitest";

import { getCurrentUser, requireUser } from "@/lib/auth/session";

import { signInAs } from "./support/auth";
import { testEmail } from "./support/mailpit";

describe("Кто вошёл", () => {
  it("без входа requireUser() отправляет на /login, после signInAs возвращает этого пользователя", async () => {
    expect(await getCurrentUser()).toBeNull();
    // In Next.js a redirect is an error with a digest that names the destination
    await expect(requireUser()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });

    const anna = await signInAs(testEmail("anna"));

    const user = await requireUser();
    expect(user.id).toBe(anna.id);
    expect(user.email).toBe(testEmail("anna"));
  });
});
