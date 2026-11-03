import { getAuth } from "@/lib/auth/auth";

// Everything Better Auth answers: the page behind a login link, sign-out, the request for a link
export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
