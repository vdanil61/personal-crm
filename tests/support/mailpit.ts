// The emails the app sent in tests are caught by Mailpit (docker compose locally, a service in CI).
// Vitest and Playwright share one Mailpit, so each of them uses its own domain for addresses
// and touches only the emails of that domain. This file has no imports from the app, so Playwright can load it too.

export type CaughtEmail = {
  id: string;
  from: { name: string; address: string };
  to: string[];
  subject: string;
  text: string;
  html: string;
};

function baseUrl(): string {
  const url = process.env.MAILPIT_URL;
  if (!url) throw new Error("MAILPIT_URL is not set: the tests read sent emails from Mailpit (see .env.example)");
  return url;
}

async function mailpit(path: string, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(`${baseUrl()}${path}`, init);
    if (!response.ok) throw new Error(`Mailpit answered ${response.status} to ${init?.method ?? "GET"} ${path}`);
    return response;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Cannot reach Mailpit. Start it with `docker compose up -d --wait` and run the tests again.");
    }
    throw error;
  }
}

// The mail of one test suite: all its addresses are on this domain
export function createMailbox(domain: string) {
  const search = (query: string) => `/api/v1/search?query=${encodeURIComponent(query)}`;

  // All emails sent to this address, the newest first
  async function findEmails(to: string): Promise<CaughtEmail[]> {
    const found = await (await mailpit(search(`to:"${to}"`))).json();
    const emails: CaughtEmail[] = [];
    for (const { ID } of found.messages as { ID: string }[]) {
      const message = await (await mailpit(`/api/v1/message/${ID}`)).json();
      emails.push({
        id: ID,
        from: { name: message.From.Name, address: message.From.Address },
        to: (message.To as { Address: string }[]).map((recipient) => recipient.Address),
        subject: message.Subject,
        text: message.Text,
        html: message.HTML,
      });
    }
    return emails;
  }

  return {
    domain,
    testEmail: (name: string) => `${name}@${domain}`,
    findEmails,

    // How many emails of this suite's domain Mailpit holds, whoever they went to
    async countTestEmails(): Promise<number> {
      const found = await (await mailpit(`${search(`to:"@${domain}"`)}&limit=1`)).json();
      return found.messages_count as number;
    },

    // The link of the "Войти" button of the newest email to this address
    async findLoginLink(to: string): Promise<string> {
      const [email] = await findEmails(to);
      if (!email) throw new Error(`No email was sent to ${to}`);
      const link = /href="([^"]*\/magic-link\/verify[^"]*)"/.exec(email.html)?.[1];
      if (!link) throw new Error("The email has no login link");
      return link.replaceAll("&amp;", "&");
    },

    // Before every test: the emails of the previous tests of this suite are gone
    async deleteTestEmails() {
      await mailpit(search(`to:"@${domain}"`), { method: "DELETE" });
    },
  };
}

const vitestMailbox = createMailbox("vitest.example.com");

export const { testEmail, findEmails, findLoginLink, countTestEmails, deleteTestEmails } = vitestMailbox;
export const TEST_EMAIL_DOMAIN = vitestMailbox.domain;
