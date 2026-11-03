import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "./auth";

// Who is signed in on this request, or null. One lookup per request, however many times it is asked.
export const getCurrentUser = cache(async () => {
  // The request first: during `next build` there is no request, the page waits here, and the login settings,
  // which the build does not have, are not looked at
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
});

// Every page with data and every server action starts with this: no login, no data
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
