"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { INVALID_EMAIL, TOO_MANY_LOGIN_LINKS, getAuth } from "@/lib/auth/auth";
import { describeError } from "@/lib/errors";
import type { LoginFormState } from "@/lib/form-state";
import { loginEmailSchema } from "@/lib/validation";

const EMAIL_INVALID_TEXT = "Проверьте адрес почты";
const TOO_MANY_TEXT = "Слишком часто, попробуйте через несколько минут";
const SEND_FAILED_TEXT = "Не удалось отправить письмо. Попробуйте ещё раз.";

// The form "Получить ссылку". The rules (the email, the limits, cancelling old links) live in the hook of
// Better Auth (src/lib/auth/auth.ts), so they hold for any request; this only turns the answer into a text.
// The text after sending is the same for a known and a new email: it must not tell who has signed in before.
export async function requestLoginLink(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const rawEmail = formData.get("email");
  const typed = typeof rawEmail === "string" ? rawEmail : "";
  const attempt = Date.now();

  const parsed = loginEmailSchema.safeParse(typed);
  if (!parsed.success) {
    return { status: "error", field: "email", email: typed, message: EMAIL_INVALID_TEXT, attempt };
  }

  try {
    await getAuth().api.signInMagicLink({ headers: await headers(), body: { email: parsed.data } });
    return { status: "sent", email: parsed.data, sentAt: attempt };
  } catch (err) {
    if (err instanceof APIError) {
      const code = (err.body as { code?: string } | undefined)?.code;
      if (code === INVALID_EMAIL) {
        return { status: "error", field: "email", email: typed, message: EMAIL_INVALID_TEXT, attempt };
      }
      if (code === TOO_MANY_LOGIN_LINKS) {
        return { status: "error", field: "form", email: typed, message: TOO_MANY_TEXT, attempt };
      }
    }
    // The class and code only: the error may carry the email address
    console.error(`Failed to send a login link: ${describeError(err)}`);
    return { status: "error", field: "form", email: typed, message: SEND_FAILED_TEXT, attempt };
  }
}

// "Выйти": ends the login of this device only, the other devices stay signed in
export async function signOut() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
