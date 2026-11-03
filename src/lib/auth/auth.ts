import "server-only";

import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { getDb } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { requiredSetting } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { loginEmailSchema } from "@/lib/validation";

import { buildLoginEmail } from "./login-email";
import { readVisitorIp, registerLoginLinkRequest } from "./login-link-limits";

// The codes the form turns into texts (see src/app/login/actions.ts)
export const INVALID_EMAIL = "INVALID_EMAIL";
export const TOO_MANY_LOGIN_LINKS = "TOO_MANY_LOGIN_LINKS";

const LOGIN_LINK_LIFETIME_SECONDS = 15 * 60;
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const SESSION_REFRESH_SECONDS = 60 * 60;

// The settings of Better Auth (the login library). The tests build a second instance from the same settings
// with extra plugins (tests/support/auth.ts), so the code under test sees the same login as the app.
export function createAuth(extraPlugins: BetterAuthPlugin[] = []) {
  return betterAuth({
    baseURL: requiredSetting("BETTER_AUTH_URL"),
    secret: requiredSetting("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    advanced: {
      // Ids are uuid, like the ids of contacts and groups
      database: { generateId: "uuid" },
      // nginx puts the visitor's address here and overwrites whatever came from outside
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    session: {
      // A login lasts 30 days from the last visit; the term moves at most once an hour
      expiresIn: SESSION_LIFETIME_SECONDS,
      updateAge: SESSION_REFRESH_SECONDS,
      // A sign-out or an expired login must show at once, so nothing is cached in the cookie
      cookieCache: { enabled: false },
    },
    // The built-in limit lives in memory and resets on restart; the limits on emails are our own (login_link_requests)
    rateLimit: { enabled: false },
    // No passwords: only signing in by a link from an email
    emailAndPassword: { enabled: false },
    hooks: {
      // Runs for every request for a login link, whether it came from our form or straight to the handler,
      // so the rules cannot be bypassed: the email is checked, the limits are counted, old links are cancelled
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/magic-link") return;

        const email = loginEmailSchema.safeParse((ctx.body as { email?: unknown } | undefined)?.email);
        if (!email.success) throw new APIError("BAD_REQUEST", { message: "Invalid email", code: INVALID_EMAIL });

        const outcome = await registerLoginLinkRequest(email.data, readVisitorIp(ctx.headers));
        if (outcome === "too-many") {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many login links", code: TOO_MANY_LOGIN_LINKS });
        }

        // Better Auth goes on with the cleaned-up email. Whoever asked, a good link leads to the main page
        // (a first sign-in too) and a link that does not work leads to the page that says so.
        return {
          context: {
            body: {
              ...(ctx.body as object),
              email: email.data,
              callbackURL: "/",
              newUserCallbackURL: "/",
              errorCallbackURL: "/login/expired",
            },
          },
        };
      }),
    },
    plugins: [
      magicLink({
        expiresIn: LOGIN_LINK_LIFETIME_SECONDS,
        // The database keeps a fingerprint of the link, not the link: whoever reads the database cannot sign in
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          await sendMail(buildLoginEmail(email, url));
        },
      }),
      // Server actions can set and clear the login cookie
      nextCookies(),
      ...extraPlugins,
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Created on first use, not at import: `next build` loads the route modules and has no login settings
let auth: Auth | undefined;

export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
