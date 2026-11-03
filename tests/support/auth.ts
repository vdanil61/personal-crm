import { eq } from "drizzle-orm";
import { type TestHelpers, testUtils } from "better-auth/plugins";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createAuth } from "@/lib/auth/auth";

import { addDefaultGroups, addUser } from "./factories";
import { setRequestHeaders } from "./request-context";

// A second Better Auth with the same settings, the same database and the same secret as the app's own,
// plus the plugin `testUtils` that can open a real login for a user without an email.
// The app code checks the login as usual, through its own Better Auth.
let testAuth: ReturnType<typeof createTestAuth> | undefined;

function createTestAuth() {
  return createAuth([testUtils()]);
}

// From now on the "request" in this test comes from this user's device. Creates the user if needed.
export async function signInAs(email: string) {
  testAuth ??= createTestAuth();
  const [found] = await getDb().select().from(users).where(eq(users.email, email));
  const user = found ?? (await addUser(email));

  // The type of `test` is lost when the plugin is added to a list built elsewhere
  const context = (await testAuth.$context) as unknown as { test: TestHelpers };
  const { headers } = await context.test.login({ userId: user.id });
  setRequestHeaders(headers);
  return user;
}

export type TestUser = Awaited<ReturnType<typeof signInAs>>;

// Signs in and gives the user the five groups the owner's account had before logins existed:
// most scenarios of groups and keep-in-touch use them
export async function signInWithGroups(email: string) {
  const user = await signInAs(email);
  await addDefaultGroups(user.id);
  return user;
}

// A visitor who is not signed in, coming from this address on the internet (nginx puts it in X-Real-IP)
export function visitFrom(ip: string) {
  setRequestHeaders(new Headers({ origin: process.env.BETTER_AUTH_URL!, "x-real-ip": ip }));
}
