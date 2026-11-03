// The headers of the "current request" for code under test. In the running app `next/headers`
// returns the headers of the request being served; in tests (see tests/support/setup.ts) it returns these.
// `signInAs` puts the login cookie here; every test starts with a visitor who is not signed in.
let current = new Headers();

export function setRequestHeaders(headers: Headers) {
  current = headers;
}

export function getRequestHeaders(): Headers {
  return current;
}

export function resetRequestHeaders() {
  current = new Headers();
}
