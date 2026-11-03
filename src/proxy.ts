import { type NextRequest, NextResponse } from "next/server";

import { getAuth } from "@/lib/auth/auth";
import { requiredSetting } from "@/lib/env";

// Runs before every page except the ones listed in the matcher below.
// Without a login it sends the visitor to the login page. With a login it lets the request through and passes
// the browser the renewed login cookie: pages cannot set cookies, and without this the cookie in the browser would
// keep its first term, so "30 days from the last visit" would turn into "30 days from signing in".
// Each page and each server action still finds out who is signed in on its own and filters data by that user.
export async function proxy(request: NextRequest) {
  // Server actions (the login form, "Выйти", every save) check the login themselves
  if (request.headers.has("next-action")) return NextResponse.next();

  const { headers, response: session } = await getAuth().api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });

  // Someone who is already signed in has nothing to do on the login page
  if (request.nextUrl.pathname === "/login") {
    return session ? redirectTo("/") : NextResponse.next();
  }
  if (!session) return redirectTo("/login");

  const next = NextResponse.next();
  for (const cookie of headers.getSetCookie()) next.headers.append("set-cookie", cookie);
  return next;
}

// The address of the app comes from the settings (the same one the links in emails use): behind nginx
// the app does not know under which name and over which protocol the visitor reached it
function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, requiredSetting("BETTER_AUTH_URL")));
}

export const config = {
  // Open without a login: the page "Ссылка устарела", the handler of Better Auth (the link from the email lands
  // there), the check the deploy uses, and the files of the app itself
  matcher: ["/((?!api/auth(?:/|$)|health(?:/|$)|login/expired(?:/|$)|_next/|icon\\.svg$|favicon\\.ico$).*)"],
};
