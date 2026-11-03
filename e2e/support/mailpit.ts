import { createMailbox } from "../../tests/support/mailpit";

// The addresses of the browser tests are on their own domain, so they never meet the emails of the unit tests
export const mailbox = createMailbox("e2e.example.com");
